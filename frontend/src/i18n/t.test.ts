import { expect, test } from 'vitest'
import en from './en.json'
import ms from './ms.json'
import { translate } from './t'

test('ms and en have exactly the same keys', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(ms).sort())
})

test('no empty strings', () => {
  for (const dict of [ms, en]) for (const v of Object.values(dict)) expect(v.trim()).not.toBe('')
})

test('fills variables and keeps unknown ones', () => {
  expect(translate('ms', 'gaji.greeting', { name: 'Faiz' })).toBe('Hai, Faiz')
  expect(translate('en', 'gaji.greeting')).toBe('Hi, {name}')
})
