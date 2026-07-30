const BETA: number[] = [
  4.730040744862704, 7.853204624095838, 10.995607838001670, 14.137165491257348,
  17.278759657399481, 20.420352245626061, 23.561944902040455, 26.703537555508186,
  29.845130209103254, 32.986722862692819, 36.128315516282622, 39.269908169872416,
  42.411500823462205, 45.553093477051995, 48.694686130641785, 51.836278784231588,
  54.977871437821380, 58.119464091411174, 61.261056745000967, 64.402649398590773,
]

function betaFor(n: number): number {
  const idx = n - 2
  if (idx < BETA.length) return BETA[idx]
  return (n - 0.5) * Math.PI
}

export function beamVal(n: number, x: number): number {
  if (n === 0) return 1
  if (n === 1) return Math.sqrt(3) * (2 * x - 1)
  const b = betaFor(n)
  const ch = Math.cosh(b), sh = Math.sinh(b)
  const c = Math.cos(b), sn = Math.sin(b)
  const sigma = (ch - c) / (sh - sn)
  const bx = b * x
  return Math.cosh(bx) + Math.cos(bx) - sigma * (Math.sinh(bx) + Math.sin(bx))
}

export function beamValClamped(n: number, x: number): number {
  const b = BETA[n]
  const ch = Math.cosh(b), sh = Math.sinh(b)
  const c = Math.cos(b), sn = Math.sin(b)
  const sigma = (ch - c) / (sh - sn)
  const bx = b * x
  return Math.cosh(bx) - Math.cos(bx) - sigma * (Math.sinh(bx) - Math.sin(bx))
}

export function beamDeriv(n: number, x: number): number {
  if (n === 0) return 0
  if (n === 1) return 2 * Math.sqrt(3)
  const b = betaFor(n)
  const ch = Math.cosh(b), sh = Math.sinh(b)
  const c = Math.cos(b), sn = Math.sin(b)
  const sigma = (ch - c) / (sh - sn)
  const bx = b * x
  return b * ((Math.sinh(bx) - Math.sin(bx)) - sigma * (Math.cosh(bx) + Math.cos(bx)))
}

export function beamDeriv2(n: number, x: number): number {
  if (n < 2) return 0
  const b = betaFor(n)
  const ch = Math.cosh(b), sh = Math.sinh(b)
  const c = Math.cos(b), sn = Math.sin(b)
  const sigma = (ch - c) / (sh - sn)
  const bx = b * x
  return b * b * ((Math.cosh(bx) - Math.cos(bx)) - sigma * (Math.sinh(bx) - Math.sin(bx)))
}
