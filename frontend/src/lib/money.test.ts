import { describe, expect, it } from 'vitest'
import { addDays, todayKL, weekStart } from './dates'
import { formatRM, parseRM } from './money'

describe('money', () => {
  it('formats sen as RM', () => {
    expect(formatRM(62000, { whole: true })).toBe('RM620')
    expect(formatRM(123450)).toBe('RM1,234.50')
    expect(formatRM(5)).toBe('RM0.05')
    expect(formatRM(-17000, { whole: true })).toBe('-RM170')
    expect(formatRM(2000, { whole: true, sign: true })).toBe('+RM20')
    expect(formatRM(123456789, { whole: true })).toBe('RM1,234,568')
  })

  it('parses typed amounts without float drift', () => {
    expect(parseRM('812.50')).toBe(81250)
    expect(parseRM('RM 1,234')).toBe(123400)
    expect(parseRM('0.1')).toBe(10)
    expect(parseRM('40')).toBe(4000)
    expect(parseRM('19.99')).toBe(1999)
    for (const bad of ['', '-5', '1.234', 'abc', '1e3']) expect(parseRM(bad)).toBeNull()
  })
})

describe('dates', () => {
  it('uses Malaysian dates and ISO weeks', () => {
    expect(todayKL(new Date('2026-10-18T17:30:00Z'))).toBe('2026-10-19') // already Monday in KL
    expect(weekStart('2026-10-25')).toBe('2026-10-19')
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
    expect(addDays('2026-10-26', -7)).toBe('2026-10-19')
  })
})
