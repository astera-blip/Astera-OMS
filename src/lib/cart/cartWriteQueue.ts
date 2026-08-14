export function createCartWriteQueue() {
  let pending = Promise.resolve();

  return function run<T>(task: () => Promise<T>): Promise<T> {
    const result = pending.then(task, task);
    pending = result.then(() => undefined, () => undefined);
    return result;
  };
}
