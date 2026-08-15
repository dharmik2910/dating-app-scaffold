import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Usage: findMe(@CurrentUser() userId: string)
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().userId;
});
