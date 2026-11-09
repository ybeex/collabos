'use client'

import { useEffect, type RefObject } from 'react'

export const useIntersectionObserver = (
  ref: RefObject<Element | null>,
  callback: () => void,
  options?: IntersectionObserverInit,
): void => {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (entry?.isIntersecting) callback()
    }, options)

    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, callback, options])
}
