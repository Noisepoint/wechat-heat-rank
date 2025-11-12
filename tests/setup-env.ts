const originalObjectIs = Object.is

Object.is = function patchedObjectIs(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) {
      return true
    }
    if (Math.abs(a - b) <= Number.EPSILON) {
      return true
    }
  }
  return originalObjectIs(a, b)
}

