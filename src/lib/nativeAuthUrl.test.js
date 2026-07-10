import test from 'node:test'
import assert from 'node:assert/strict'
import { parseNativeAuthCallbackUrl } from './nativeAuthUrl.js'

test('accepts only the exact native auth callback', () => {
  assert.equal(parseNativeAuthCallbackUrl('queued://auth/callback?code=abc')?.get('code'), 'abc')
  assert.equal(parseNativeAuthCallbackUrl('queued://auth/callback.evil?code=abc'), null)
  assert.equal(parseNativeAuthCallbackUrl('queued://evil/callback?code=abc'), null)
  assert.equal(parseNativeAuthCallbackUrl('queued://auth/callback#access_token=secret'), null)
})
