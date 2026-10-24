import { getRoomPermissionDisplay } from './roomPermission';

describe('getRoomPermissionDisplay', () => {
  it('shows the permission level when it is not none', () => {
    expect(getRoomPermissionDisplay({ permissionlevel: 'REGISTERED', privilegelevel: 'VIP' })).toBe('registered');
  });

  it('falls back to the privilege level when the permission level is none', () => {
    expect(getRoomPermissionDisplay({ permissionlevel: 'NONE', privilegelevel: 'Donator' })).toBe('donator');
  });

  it('shows none when neither level is set', () => {
    expect(getRoomPermissionDisplay({ permissionlevel: 'none', privilegelevel: '' })).toBe('none');
    expect(getRoomPermissionDisplay({ permissionlevel: '', privilegelevel: '' })).toBe('none');
  });

  it('keeps desktop\'s quirk that an empty permission level hides the privilege level', () => {
    expect(getRoomPermissionDisplay({ permissionlevel: '', privilegelevel: 'vip' })).toBe('none');
  });
});
