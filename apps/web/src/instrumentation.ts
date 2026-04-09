// This runs before any module is loaded — ensures reflect-metadata is available
// for @velnari/shared-types which uses class-validator decorators
export async function register() {
  await import('reflect-metadata');
}
