export function generateInviteCode(): string {
  // Generate 8-char alphanumeric code (uppercase letters + digits)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // Exclude confusing chars: 0OI1
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
