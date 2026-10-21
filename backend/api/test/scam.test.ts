import { expect, it } from 'vitest'
import { checkLink, checkMessage } from '../src/services/scam.ts'
import { demo, fakeLlm } from './helpers.ts'

it('flags the messages riders really get, in BM, English and Manglish', () => {
  const blocked = checkMessage('GRAB: Akaun anda telah disekat. Sahkan segera di http://grab-rider-my.com/verify dalam 24 jam')
  expect(blocked.level).toBe('tinggi')
  expect(blocked.flags).toEqual(expect.arrayContaining(['account_blocked', 'urgent', 'lookalike_link']))
  expect(blocked.links[0]).toMatchObject({ host: 'grab-rider-my.com', official: false, lookalikeOf: 'grab' })

  expect(checkMessage('Boss, sila hantar kod TAC yang baru masuk tu, saya tersalah taip nombor').level).toBe('tinggi')
  expect(checkMessage('Nak duit lebih? Sewa akaun bank anda RM500 seminggu, senang je').flags).toContain('mule')
  expect(checkMessage('Ini pegawai PDRM. Akaun anda terlibat dalam pengubahan wang haram, waran tangkap dikeluarkan').flags).toContain('authority')
  expect(checkMessage('Tahniah! Anda menang hadiah RM3,000. Bayar kos penghantaran RM15 dulu untuk tuntut').level).toBe('tinggi')
  expect(checkMessage('Kerja sambilan, like dan follow je, gaji RM200 sehari. Download app kat sini').flags).toEqual(expect.arrayContaining(['job_offer', 'apk']))
  expect(checkMessage('Parcel anda tertahan, sila kemaskini alamat: bit.ly/3xYzAb').flags).toContain('short_link')
  expect(checkMessage('Login sini http://103.21.4.9/maybank').flags).toContain('ip_link')
})

it('leaves ordinary messages and official links alone', () => {
  const ok = checkMessage('Order #8812 dah sampai. Terima kasih! Jumlah RM12.50. Lihat resit di https://www.grab.com/my/receipts')
  expect(ok.level).toBe('rendah')
  expect(ok.links).toEqual([{ host: 'grab.com', official: true, lookalikeOf: null }])
  expect(checkLink('help.foodpanda.my').official).toBe(true)
  expect(checkLink('www.hasil.gov.my').official).toBe(true)
  expect(checkLink('sh0pee-rebate.xyz').lookalikeOf).toBe('shopee')
  expect(checkLink('tng-ewallet-bonus.com').lookalikeOf).toBe('touchngo')
})

it('pulls out phone numbers to look up on Semak Mule', () => {
  expect(checkMessage('Call 012-345 6789 or +60198765432 now').phones).toEqual(['0123456789', '+60198765432'])
})

it('works without AI, and AI signs can only add, never lower the level', async () => {
  const a = await demo()
  const rules = (await a.post('/api/scam-check').send({ text: 'Akaun anda disekat, sila hantar OTP segera' })).body
  expect(rules).toMatchObject({ level: 'tinggi', usedAi: false, extraFlags: [] })

  const llm = fakeLlm()
  llm.reply = JSON.stringify({ red_flags: ['Mesej ini datang dari nombor peribadi, bukan nombor rasmi.'] })
  const plain = (await a.post('/api/scam-check').send({ text: 'Hai, boleh saya tanya sesuatu tentang order tadi?' })).body
  expect(plain).toMatchObject({ level: 'sederhana', usedAi: true, extraFlags: ['Mesej ini datang dari nombor peribadi, bukan nombor rasmi.'] })
  expect(JSON.stringify(llm.requests[0]!.messages)).toContain('<message>')
})
