import { useEffect, useState } from "react"

export type Listener<T> = (state: T, prev: T) => void

export type IsPlainObject<T> = T extends Record<string, any> ? (T extends any[] ? false : true) : false

export type NewState<T> = IsPlainObject<T> extends true ? Partial<T> | ((prev: T) => Partial<T>) : T | ((prev: T) => T)

export type SetState<T> = (newState: NewState<T>) => void

export interface UseStore<T> {
    (): [T, SetState<T>]
    getState(): T
    setState: SetState<T>
    subscribe(listener: Listener<T>): () => void
}

export function isPlainObject<T>(obj: T): obj is T & Record<string, any> {
    return typeof obj === "object" && obj !== null && Object.getPrototypeOf(obj) === Object.prototype
}

export function createStore<T>(init: T | (() => T)): UseStore<T> {
    let nowState: T = typeof init === "function" ? (init as () => T)() : init

    const listeners = new Set<Listener<T>>()

    function read() {
        return nowState
    }

    function write(newState: NewState<T>) {
        if (Object.is(nowState, newState)) return
        const prevState = nowState
        if (isPlainObject(prevState)) {
            const nextState = (typeof newState === "function" ? (newState as (prev: T) => Partial<T>)(prevState) : newState) as Partial<T>
            nowState = Object.assign({}, prevState, nextState)
        } else {
            nowState = (typeof newState === "function" ? (newState as (prev: T) => T)(prevState) : newState) as T
        }
        listeners.forEach(listener => listener(nowState, prevState))
    }

    function subscribe(listener: Listener<T>) {
        listeners.add(listener)
        return function unsubscribe() {
            listeners.delete(listener)
        }
    }

    function useStore(): [T, SetState<T>] {
        const [state, setState] = useState(nowState)
        useEffect(() => subscribe(nowState => setState(nowState)), [])
        function newSetState(newState: NewState<T>) {
            write(newState)
        }
        return [state, newSetState]
    }

    useStore.getState = read
    useStore.setState = write
    useStore.subscribe = subscribe

    return useStore
}

export interface StateStorage {
    getItem: (name: string) => string | null | Promise<string | null>
    setItem: (name: string, value: string) => any | Promise<any>
    removeItem: (name: string) => any | Promise<any>
}

export interface CreatePersistentStoreOption<T = any> {
    name: string
    storage?: StateStorage | (() => StateStorage)
    store?: (state: T) => string
    restore?: (state: string) => T
}

export function createPersistentStore<T>(init: T | (() => T), optionOrString: CreatePersistentStoreOption<T> | string): UseStore<T> {
    const options = typeof optionOrString === "string" ? { name: optionOrString } : optionOrString
    const { name, store = JSON.stringify, restore = JSON.parse } = options
    const storage: StateStorage = typeof options.storage === "function" ? options.storage() : options.storage || window.localStorage
    const key = `react-soda-${name}`
    const strOrPromise = storage.getItem(key)
    let changed = false
    if (strOrPromise instanceof Promise) {
        strOrPromise
            .then(str => {
                if (changed || str === null) return
                const data = restore(str)
                useStore.setState(data)
            })
            .catch(error => {
                console.error(error)
            })
    } else if (strOrPromise !== null) {
        let data: T
        let success = false
        try {
            data = restore(strOrPromise)
            success = true
        } catch (error) {
            console.error(error)
        }
        if (success) {
            const useStore = createStore(data! as T)
            useStore.subscribe(state => storage.setItem(key, store(state)))
            return useStore
        }
    }
    const useStore = createStore(init)
    const unsubscribe = useStore.subscribe(() => {
        changed = true
        unsubscribe()
    })
    useStore.subscribe(state => storage.setItem(key, store(state)))
    return useStore
}

export default createStore
