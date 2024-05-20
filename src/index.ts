import { useSyncExternalStore } from "react"

export type Listener<T> =
    /**
     * @param state Current state.
     *
     * 当前状态
     *
     * @param prev Previous state.
     *
     * 上一次的状态
     */
    (state: T, prev: T) => void

export type IsPlainObject<T> = T extends Record<string, any> ? (T extends any[] ? false : T extends Function ? false : true) : false

export type NewState<T> = IsPlainObject<T> extends true ? Partial<T> | ((prev: T) => Partial<T>) : T | ((prev: T) => T)

export type PlainObjectSetState<T> =
    /**
     * @param newState new state
     *
     * 新的状态
     *
     * @param replace This parameter will only take effect when the current and subsequent states are plain objects that are not arrays. It determines whether to replace the original object directly, with the default being false
     *
     * 只有当前后的状态均为非数组的普通对象时，这个参数才会生效，是否直接替换原对象，默认为 false
     *
     * @default false
     *
     */
    (newState: NewState<T>, replace?: boolean) => void

export type NonPlainObjectSetState<T> =
    /**
     * @param newState new state
     *
     * 新的状态
     */
    (newState: NewState<T>) => void

export type SetState<T> = IsPlainObject<T> extends true ? PlainObjectSetState<T> : NonPlainObjectSetState<T>

export interface UseStore<T> {
    /**
     * Get the current state and the function to set the state.
     *
     * 获取最新状态和设置状态的函数
     */
    (): [T, SetState<T>]
    /**
     * atom state
     *
     * 原子状态
     */
    <X>(selector: (state: T) => X): [X, SetState<T>]
    /**
     * Get the current state.
     *
     * 获取最新状态
     */
    getState(): T
    /**
     * atom state
     *
     * 原子状态
     */
    getState<X>(selector: (state: T) => X): X
    /**
     * Set the state.
     *
     * 设置状态
     */
    setState: SetState<T>
    /**
     * @param listener listener
     *
     * 监听器
     *
     * @returns The function to unsubscribe.
     *
     * 取消监听的函数
     */
    subscribe(listener: Listener<T>): () => void
}

export function isPlainObject<T>(obj: T): obj is T & Record<string, any> {
    return typeof obj === "object" && obj !== null && Object.getPrototypeOf(obj) === Object.prototype
}

/**
 * Create a store.
 *
 * 创建一个 store
 *
 * @param init The initial state, or a function that returns the initial state.
 *
 * 初始状态，或者返回初始状态的函数
 */
export function createStore<T>(init: T | (() => T)): UseStore<T> {
    let nowState: T = typeof init === "function" ? (init as () => T)() : init

    const listeners = new Set<Listener<T>>()

    function getState(selector?: (state: T) => any) {
        if (typeof selector === "function") return selector(nowState)
        return nowState
    }

    function setState(newState: NewState<T>, replace?: boolean) {
        if (Object.is(nowState, newState)) return
        const prevState = nowState
        const nextState = typeof newState === "function" ? (newState as (prev: T) => Partial<T>)(prevState) : newState
        if (Object.is(prevState, nextState)) return
        if (isPlainObject(prevState) && isPlainObject(nextState) && !replace) {
            nowState = Object.assign({}, prevState, nextState)
        } else {
            nowState = nextState as T
        }
        listeners.forEach(listener => listener(nowState, prevState))
    }

    function subscribe(listener: Listener<T>) {
        listeners.add(listener)
        return function unsubscribe() {
            listeners.delete(listener)
        }
    }

    const _getState = getState

    function useStore(selector?: (state: T) => any): any {
        function getState() {
            return _getState(selector)
        }
        const state = useSyncExternalStore(subscribe, getState)
        return [state, setState]
    }

    useStore.getState = getState
    useStore.setState = setState
    useStore.subscribe = subscribe

    return useStore
}

export interface StateStorage {
    getItem: (name: string) => string | null | Promise<string | null>
    setItem: (name: string, value: string) => any | Promise<any>
    removeItem: (name: string) => any | Promise<any>
}

export interface CreatePersistentStoreOption<T = any> {
    /**
     * The unique name.
     *
     * 唯一标识符
     */
    name: string
    /**
     * The persistent storage engine, default is `globalThis.localStorage`.
     *
     * 持久化存储引擎，默认为 `globalThis.localStorage`
     *
     * @default globalThis.localStorage
     */
    storage?: StateStorage | (() => StateStorage)
    /**
     * The function to convert the state to a string, default is `JSON.stringify`.
     *
     * 将状态转换成字符串的函数，默认为 `JSON.stringify`
     *
     * @default JSON.stringify
     */
    stringify?: (state: T) => string
    /**
     * The function to convert the string to a state, default is `JSON.parse`.
     *
     * 将字符串转换成状态的函数，默认为 `JSON.parse`
     *
     * @default JSON.parse
     */
    parse?: (state: string) => T
}

export interface UsePersistentStore<T> extends UseStore<T> {
    /**
     * Get the current persistent storage.
     *
     * 获取当前的持久化存储
     */
    getStorage(): StateStorage
    /**
     * Get the unique name.
     *
     * 获取唯一标识符
     */
    getName(): string
    /**
     * Get the unique key in the persistent state.
     *
     * 获取在持久化存储的唯一 key
     */
    getStorageKey(): string
    /**
     * Get the function to convert the state to a string.
     *
     * 获取将状态转换成字符串的函数
     */
    getStringify(): (state: T) => string
    /**
     * Get the function to convert the string to a state.
     *
     * 获取将字符串转换成状态的函数
     */
    getParse(): (state: string) => T
    /**
     * Remove the data of the current state in the persistent storage.
     *
     * 移除当前状态在持久化存储中的数据
     */
    removeStorage(): void
}

/**
 * Create a persistent store.
 *
 * 创建一个持久化存储
 *
 * @param init The initial state, or a function that returns the initial state.
 *
 * 初始状态，或者返回初始状态的函数
 *
 * @param optionOrString The option or the unique key of the persistent state.
 *
 * 选项或者持久化存储的唯一 key
 */
export function createPersistentStore<T>(init: T | (() => T), optionOrString: CreatePersistentStoreOption<T> | string): UsePersistentStore<T> {
    const options = typeof optionOrString === "string" ? { name: optionOrString } : optionOrString
    const { name, stringify = JSON.stringify, parse = JSON.parse } = options
    const storage: StateStorage = typeof options.storage === "function" ? options.storage() : options.storage || globalThis.localStorage
    const storageKey = `react-soda-${name}`
    function getStorage() {
        return storage
    }
    function getName() {
        return name
    }
    function getStorageKey() {
        return storageKey
    }
    function getStringify() {
        return stringify
    }
    function getParse() {
        return parse
    }
    function removeStorage() {
        storage.removeItem(storageKey)
    }
    const strOrPromise = storage.getItem(storageKey)
    let changed = false
    if (strOrPromise instanceof Promise) {
        strOrPromise
            .then(str => {
                if (changed || str === null) return
                let data: T
                let success = false
                try {
                    data = parse(str)
                    success = true
                } catch (error) {
                    storage.removeItem(storageKey)
                    console.error(error)
                }
                if (success) {
                    useStore.setState(data!)
                }
            })
            .catch(error => {
                console.error(error)
            })
    } else if (strOrPromise !== null) {
        let data: T
        let success = false
        try {
            data = parse(strOrPromise)
            success = true
        } catch (error) {
            storage.removeItem(storageKey)
            console.error(error)
        }
        if (success) {
            const useStore = createStore(data! as T) as UsePersistentStore<T>
            useStore.getStorage = getStorage
            useStore.getName = getName
            useStore.getStorageKey = getStorageKey
            useStore.getStringify = getStringify
            useStore.getParse = getParse
            useStore.removeStorage = removeStorage
            storage.setItem(storageKey, stringify(useStore.getState()))
            useStore.subscribe(state => storage.setItem(storageKey, stringify(state)))
            return useStore
        }
    }
    const useStore = createStore(init) as UsePersistentStore<T>
    useStore.getStorage = getStorage
    useStore.getName = getName
    useStore.getStorageKey = getStorageKey
    useStore.getStringify = getStringify
    useStore.getParse = getParse
    useStore.removeStorage = removeStorage
    storage.setItem(storageKey, stringify(useStore.getState()))
    const unsubscribe = useStore.subscribe(() => {
        changed = true
        unsubscribe()
    })
    useStore.subscribe(state => storage.setItem(storageKey, stringify(state)))
    return useStore
}

export default createStore
