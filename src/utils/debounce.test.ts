import { sleep } from "bun";
import { expect, test } from "bun:test";
import { spy } from "nanospy";

import { debounce } from "./debounce";

const duration = 50;

test("calls the passed function with correct args", async () => {
  const func = spy();
  const debouncer = debounce(func, { threshold: duration });

  debouncer("123", 123);

  expect(func.callCount).toBe(0);

  await sleep(duration);
  expect(func.callCount).toBe(1);
  expect(func.calls[0]).toEqual(["123", 123]);
});

test("calls the passed function only once within a threshold", async () => {
  const func = spy();
  const debouncer = debounce(func, { threshold: duration });

  debouncer("123", 123);
  debouncer("124", 124);
  debouncer("125", 125);
  debouncer("126", 126);
  expect(func.callCount).toBe(0);

  await sleep(duration);
  expect(func.callCount).toBe(1);

  debouncer("123", 123);
  debouncer("124", 124);
  debouncer("125", 125);
  debouncer("126", 126);

  await sleep(duration);
  expect(func.callCount).toBe(2);
});

test("calls the passed function with the latest args", async () => {
  const func = spy();
  const debouncer = debounce(func, { threshold: duration });

  debouncer("123", 123);
  debouncer("124", 124);
  debouncer("125", 125);
  debouncer("126", 126);

  await sleep(duration);

  expect(func.callCount).toBe(1);
  expect(func.calls[0]).toEqual(["126", 126]);
});

test("returns latest function result", async () => {
  const func = spy();
  const debouncer = debounce(func, { threshold: duration });

  debouncer("123", 123);
  debouncer("124", 124);
  debouncer("125", 125);
  debouncer("126", 126);

  await sleep(duration);

  expect(func.callCount).toBe(1);
  expect(func.calls[0]).toEqual(["126", 126]);
});

test("throttles the call", async () => {
  const func = spy();
  const debouncer = debounce(func, { threshold: duration, throttle: true });

  debouncer("123", 123);
  debouncer("124", 124);
  debouncer("125", 125);
  debouncer("126", 126);

  await sleep(duration - 1);
  debouncer("127", 127);

  await sleep(duration / 2);
  debouncer("128", 128);

  await sleep(duration);

  expect(func.callCount).toBe(1);
  expect(func.calls[0]).toEqual(["128", 128]);
});
