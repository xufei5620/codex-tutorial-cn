// Coordinates browser drafts and durable local screenshot files.
const copy = value => JSON.parse(JSON.stringify(value))
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)
const content = s => stable({records: s.records, hideMissing: !!s.hideMissing})

export function reconcileDraft(disk, draft, revision) {
  if (!draft || draft.autosave?.pending === false && !draft.autosave?.conflict) return {snapshot: disk, pending: false, conflict: false}
  const matches = draft.autosave?.baseRevision === revision
  const emptyDisk = !Object.keys(disk.records).length && !disk.updatedAt
  const conflicts = Object.entries(draft.records).some(([id, record]) =>
    disk.records[id] && stable(disk.records[id]) !== stable(record))
  const hideConflict = !!draft.hideMissing !== !!disk.hideMissing
  const snapshot = {...disk, ...draft, records: {...disk.records, ...draft.records}}
  return {snapshot, pending: content(snapshot) !== content(disk), conflict: !!draft.autosave?.conflict || !matches && !emptyDisk && (conflicts || hideConflict)}
}

export function createAutosave({state, getSnapshot, applySnapshot, readCache, writeCache,
  writeRecovery, loadRemote, saveRemote, normalize, notify = () => {}, delay = 400}) {
  let revision = null, initialized = false, mode = 'browser', sequence = 0, cacheConflict = false
  let initialSnapshot = null, earlyTouched = new Set(), earlyHideTouched = false
  let timer, inFlight, initializing, cacheQueue = Promise.resolve(), stopped = false
  const cached = (snapshot, pending) => ({...copy(snapshot), autosave: {baseRevision: revision, pending, conflict: cacheConflict}})
  const queueCache = (snapshot, pending) => {
    const value = cached(snapshot, pending)
    cacheQueue = cacheQueue.catch(() => {}).then(() => writeCache(value))
    cacheQueue.catch(() => {})
    return cacheQueue
  }
  const apply = snapshot => applySnapshot(normalize(snapshot))
  const error = e => {
    state.saveStatus = e.status === 409 ? 'conflict' : 'error'
    if (e.status === 409) cacheConflict = true
    state.saveError = e.message || '自动保存失败，请重试或导出备份。'
    state.dirty = true
    if (initialized && cacheConflict) queueCache(getSnapshot(), true)
  }
  const schedule = () => {
    clearTimeout(timer)
    if (stopped || !initialized || state.saveStatus === 'conflict') return
    timer = setTimeout(() => { flush().catch(error) }, delay)
  }
  function changed() {
    sequence++
    if (!initialized && initialSnapshot) {
      const current = getSnapshot()
      const ids = new Set([...Object.keys(initialSnapshot.records), ...Object.keys(current.records)])
      for (const id of ids) if (stable(initialSnapshot.records[id]) !== stable(current.records[id])) earlyTouched.add(id)
      if (!!initialSnapshot.hideMissing !== !!current.hideMissing) earlyHideTouched = true
    }
    state.dirty = true
    if (state.saveStatus !== 'conflict') state.saveStatus = initialized ? 'saving' : 'loading'
    // Read the old draft before writing any newly initialized state.
    if (initialized) queueCache(getSnapshot(), true)
    schedule()
  }
  async function start() {
    if (initializing) return initializing
    state.saveStatus = 'loading'
    initialSnapshot = copy(getSnapshot())
    initializing = (async () => {
      const [cacheResult, diskResult] = await Promise.allSettled([readCache(), loadRemote()])
      let draft = null
      if (cacheResult.status === 'fulfilled' && cacheResult.value) {
        try { draft = {...normalize(cacheResult.value), autosave: cacheResult.value.autosave} }
        catch (e) { notify('浏览器草稿无法读取：' + e.message) }
      }
      const currentEdits = sequence ? getSnapshot() : null
      const earlyPatch = currentEdits ? Object.fromEntries([...earlyTouched].map(id => [id, currentEdits.records[id]])) : {}
      const hasEarlyEdits = !!currentEdits && (earlyTouched.size > 0 || earlyHideTouched)
      if (diskResult.status === 'fulfilled' && diskResult.value) {
        mode = 'local'
        state.localAvailable = true
        const remote = diskResult.value
        revision = remote.revision
        state.savedAt = remote.savedAt
        state.saveDirectory = remote.directory
        const result = reconcileDraft(normalize(remote.snapshot), draft, revision)
        apply(result.snapshot)
        if (hasEarlyEdits) apply({...getSnapshot(), records: {...getSnapshot().records, ...earlyPatch}, hideMissing: earlyHideTouched ? currentEdits.hideMissing : getSnapshot().hideMissing})
        if (result.conflict) {
          cacheConflict = true
          state.cache = draft
          state.saveStatus = 'conflict'
          state.saveError = '浏览器草稿与磁盘版本不同，已保留两份内容。请先导出当前备份，再加载磁盘版本。'
          state.dirty = true
        } else if (result.pending || hasEarlyEdits) {
          sequence++
          state.saveStatus = 'saving'
          state.dirty = true
        } else {
          state.saveStatus = 'saved'
          state.dirty = false
        }
      } else {
        if (draft) apply(draft)
        if (hasEarlyEdits) apply({...getSnapshot(), records: {...getSnapshot().records, ...earlyPatch}, hideMissing: earlyHideTouched ? currentEdits.hideMissing : getSnapshot().hideMissing})
        mode = diskResult.status === 'rejected' ? 'unavailable' : 'browser'
        state.localAvailable = false
        state.dirty = hasEarlyEdits || !!draft
        state.saveStatus = mode === 'browser' ? 'browser' : 'error'
        state.saveError = mode === 'unavailable' ? diskResult.reason.message : ''
        if (draft && mode === 'unavailable') notify('已恢复浏览器草稿；本地文件保存暂不可用。')
      }
      initialized = true
      if (state.saveStatus === 'conflict') return
      if (mode === 'local' && state.dirty) await flush()
      else if (mode === 'browser') {
        const at = sequence
        try {
          await queueCache(getSnapshot(), false)
          if (at === sequence) state.dirty = false
        } catch (e) { error(e) }
      }
    })()
    return initializing
  }
  async function flush() {
    clearTimeout(timer)
    if (!initialized || stopped || state.saveStatus === 'conflict') return
    if (inFlight) return inFlight
    inFlight = (async () => {
      do {
        const at = sequence, snapshot = copy(getSnapshot())
        state.saveStatus = 'saving'
        state.saveError = ''
        try {
          if (mode === 'unavailable') throw Error('本地自动保存服务未连接，请重试；当前内容仍保留在浏览器。')
          if (mode === 'browser') {
            await queueCache(snapshot, false)
            if (at === sequence) {state.dirty = false; state.saveStatus = 'browser'}
          } else {
            const remote = await saveRemote(snapshot, revision)
            revision = remote.revision
            state.savedAt = remote.savedAt
            state.saveDirectory = remote.directory
            if (at === sequence) {
              apply(remote.snapshot)
              state.dirty = false
              state.saveStatus = 'saved'
            }
            queueCache(getSnapshot(), state.dirty)
          }
          if (at === sequence) break
        } catch (e) { error(e); break }
      } while (!stopped)
    })().finally(() => {inFlight = null})
    return inFlight
  }
  async function retry() {
    if (state.saveStatus === 'conflict') return
    if (inFlight) await inFlight
    if (mode === 'unavailable') {
      try {
        const remote = await loadRemote()
        if (!remote) throw Error('本地预览没有启用自动保存服务。')
        const result = reconcileDraft(normalize(remote.snapshot), cached(getSnapshot(), true), remote.revision)
        if (result.conflict) throw Object.assign(Error('磁盘内容已变化，请先导出当前备份，再重新加载。'), {status: 409})
        revision = remote.revision
        mode = 'local'
        state.localAvailable = true
        state.saveDirectory = remote.directory
        apply(result.snapshot)
      } catch (e) {error(e); return}
    }
    await flush()
  }
  async function reloadSaved() {
    clearTimeout(timer)
    if (inFlight) await inFlight
    const at = sequence
    try {
      const remote = await loadRemote()
      if (!remote) throw Error('无法读取本地保存文件。')
      // Preserve the unsaved variant before displaying the disk version.
      const recovery = copy(getSnapshot())
      await writeRecovery(recovery)
      state.cache = recovery
      if (at !== sequence) throw Object.assign(Error('读取磁盘期间又有新修改，已保留当前内容，请先导出备份后重试。'), {status: 409})
      cacheConflict = false
      apply(remote.snapshot)
      revision = remote.revision
      mode = 'local'
      state.localAvailable = true
      state.savedAt = remote.savedAt
      state.saveDirectory = remote.directory
      state.saveStatus = 'saved'
      state.saveError = ''
      state.dirty = false
      await queueCache(getSnapshot(), false)
      notify('已加载磁盘内容；原草稿另存于本机恢复缓存，可用“恢复本机草稿”取回。')
    } catch (e) { error(e) }
  }
  function dispose() {stopped = true; clearTimeout(timer)}
  return {start, changed, flush, retry, reloadSaved, dispose, cacheSettled: () => cacheQueue}
}
