type MergeWithPriority<T, P> = T & Omit<P, keyof T>;
