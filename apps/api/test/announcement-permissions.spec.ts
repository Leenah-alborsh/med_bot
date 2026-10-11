import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AnnouncementsController } from '../src/announcements/announcements.controller.js';
import { PERMISSIONS_METADATA_KEY as PERMISSIONS_KEY } from '../src/auth/permissions.decorator.js';

function methodPermissions(name: string): unknown {
  const method: unknown = Object.getOwnPropertyDescriptor(
    AnnouncementsController.prototype,
    name,
  )?.value;
  if (typeof method !== 'function') throw new Error('Controller method not found');
  return Reflect.getMetadata(PERMISSIONS_KEY, method) as unknown;
}

describe('bot management permission boundaries', () => {
  it('separates reading, managing the bot, and sending announcements', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AnnouncementsController)).toEqual([
      'announcements.send',
    ]);
    expect(methodPermissions('settings')).toEqual(['bots.read']);
    expect(methodPermissions('updateWelcome')).toEqual(['bots.manage']);
    expect(methodPermissions('updateProfilePhoto')).toEqual(['bots.manage']);
  });
});
