
declare type BaseTypes = string | number | boolean;

declare type CollectionTypes = IterableCollections | WeakCollections;

export declare function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;

export declare function computed<T>(options: WritableComputedOptions<T>): WritableComputedRef<T>;

export declare type ComputedGetter<T> = (ctx?: any) => T;

export declare interface ComputedRef<T = any> extends WritableComputedRef<T> {
    readonly value: T;
}

export declare type ComputedSetter<T> = (v: T) => void;

export declare type DebuggerEvent = {
    effect: ReactiveEffect;
    target: object;
    type: TrackOpTypes | TriggerOpTypes;
    key: any;
} & DebuggerEventExtraInfo;

declare interface DebuggerEventExtraInfo {
    newValue?: any;
    oldValue?: any;
    oldTarget?: Map<any, any> | Set<any>;
}

declare type Dep = Set<ReactiveEffect>;

export declare function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions): ReactiveEffect<T>;

export declare function enableTracking(): void;

export declare function isReactive(value: unknown): boolean;

export declare function isReadonly(value: unknown): boolean;

export declare function isRef<T>(r: Ref<T> | unknown): r is Ref<T>;

declare const isRefSymbol: unique symbol;

declare type IterableCollections = Map<any, any> | Set<any>;

export declare const ITERATE_KEY: unique symbol;

export declare function lock(): void;

export declare function markNonReactive<T>(value: T): T;

export declare function markReadonly<T>(value: T): T;

export declare function pauseTracking(): void;

export declare function reactive<T extends object>(target: T): UnwrapNestedRefs<T>;

export declare interface ReactiveEffect<T = any> {
    (): T;
    _isEffect: true;
    active: boolean;
    raw: () => T;
    deps: Array<Dep>;
    options: ReactiveEffectOptions;
}

export declare interface ReactiveEffectOptions {
    lazy?: boolean;
    computed?: boolean;
    scheduler?: (run: Function) => void;
    onTrack?: (event: DebuggerEvent) => void;
    onTrigger?: (event: DebuggerEvent) => void;
    onStop?: () => void;
}

export declare function readonly<T extends object>(target: T): Readonly<UnwrapNestedRefs<T>>;

export declare interface Ref<T = any> {
    [isRefSymbol]: true;
    value: T;
}

export declare function ref<T>(value: T): T extends Ref ? T : Ref<UnwrapRef<T>>;

export declare function ref<T = any>(): Ref<T>;

export declare function resetTracking(): void;

export declare function shallowReactive<T extends object>(target: T): T;

export declare function shallowReadonly<T extends object>(target: T): Readonly<{
    [K in keyof T]: UnwrapNestedRefs<T[K]>;
}>;

export declare function shallowRef<T>(value: T): T extends Ref ? T : Ref<T>;

export declare function shallowRef<T = any>(): Ref<T>;

export declare function stop(effect: ReactiveEffect): void;

export declare function toRaw<T>(observed: T): T;

export declare function toRefs<T extends object>(object: T): {
    [K in keyof T]: Ref<T[K]>;
};

export declare function track(target: object, type: TrackOpTypes, key: unknown): void;

export declare const enum TrackOpTypes {
    GET = "get",
    HAS = "has",
    ITERATE = "iterate"
}

export declare function trigger(target: object, type: TriggerOpTypes, key?: unknown, newValue?: unknown, oldValue?: unknown, oldTarget?: Map<unknown, unknown> | Set<unknown>): void;

export declare const enum TriggerOpTypes {
    SET = "set",
    ADD = "add",
    DELETE = "delete",
    CLEAR = "clear"
}

export declare function unlock(): void;

export declare function unref<T>(ref: T): T extends Ref<infer V> ? V : T;

declare type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRef<T>;

export declare type UnwrapRef<T> = {
    cRef: T extends ComputedRef<infer V> ? UnwrapRef<V> : T;
    ref: T extends Ref<infer V> ? UnwrapRef<V> : T;
    array: T;
    object: {
        [K in keyof T]: UnwrapRef<T[K]>;
    };
}[T extends ComputedRef<any> ? 'cRef' : T extends Array<any> ? 'array' : T extends Ref | Function | CollectionTypes | BaseTypes ? 'ref' : T extends object ? 'object' : 'ref'];

declare type WeakCollections = WeakMap<any, any> | WeakSet<any>;

export declare interface WritableComputedOptions<T> {
    get: ComputedGetter<T>;
    set: ComputedSetter<T>;
}

export declare interface WritableComputedRef<T> extends Ref<T> {
    readonly effect: ReactiveEffect<T>;
}

export { }
