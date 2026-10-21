// Uploaded media bytes live in this browser's IndexedDB. They are never sent anywhere.
const DB_NAME = 'ngyn-soc-web-media'
const STORE = 'files'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB is not available in this browser.'))
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export const putBlob = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id)).then(() => undefined)
export const getBlob = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id))
export const deleteBlob = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined)
export const clearBlobs = () => run('readwrite', (s) => s.clear()).then(() => undefined)
