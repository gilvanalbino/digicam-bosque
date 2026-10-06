// Same implementation as https://github.com/vueuse/vueuse/blob/main/packages/core/onClickOutside/index.ts

import { watch, unref, onUnmounted } from 'vue';

const EVENTS = ['mousedown', 'touchstart', 'pointerdown'];

const noop = () => {};

function unrefElement(elRef) {
  return unref(elRef)?.$el ?? unref(elRef);
}

function useEventListener(...args) {
  let target;
  let event;
  let listener;
  let options;

  [target, event, listener, options] = args;

  if (!target) return noop;

  let cleanup = noop;

  const stopWatch = watch(
    () => unref(target),
    (el) => {
      cleanup();
      if (!el) return;

      el.addEventListener(event, listener, options);

      cleanup = () => {
        el.removeEventListener(event, listener, options);
        cleanup = noop;
      };
    },
    { immediate: true }
  );

  // atenção: sem esta definição local, "stop" resolvia para window.stop(), que aborta
  // todas as requisições em andamento da página quando o componente é desmontado
  const stop = () => {
    stopWatch();
    cleanup();
  };

  onUnmounted(stop);

  return stop;
}

export default function useClickOutside() {
  function onClickOutside(target, callback) {
    const listener = (event) => {
      const el = unrefElement(target);
      if (!el) return;

      if (el === event.target || event.composedPath().includes(el)) return;

      callback(event);
    };

    let disposables = EVENTS.map((event) => useEventListener(window, event, listener, { passive: true }));

    const stop = () => {
      disposables.forEach((stop) => stop());
      disposables = [];
    };

    onUnmounted(stop);

    return stop;
  }
  return {
    onClickOutside,
  };
}
