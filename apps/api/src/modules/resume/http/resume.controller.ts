import {
  createBulletRequestSchema,
  createItemRequestSchemas,
  orderRequestSchema,
  updateBulletRequestSchema,
  updateItemRequestSchemas,
  saveProfileRequestSchema,
  type BulletResponse,
  type CreateBulletRequest,
  type InvalidSkillsProblem,
  type MasterResume,
  type OrderRequest,
  type UpdateBulletRequest,
  type OrderResponse,
  type Profile,
  type ResumeSection,
  type ResumeSummary,
  type SaveProfileRequest,
} from '@am/contracts';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ProblemDetailsException, problemFor } from '../../../infra/http/problem-details.js';
import { zodBody } from '../../../infra/http/zod-body.pipe.js';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../identity/index.js';
import { InvalidDatesError, InvalidSkillsError, LimitReachedError, OrderMismatchError, ResumeNotFoundError, ResumeService, type ResumeItem } from '../application/resume.service.js';
import { isBulletSection, parseSection, type BulletSection } from '../domain/sections.js';

/** The rule errors of the service as the Problem Details answers the spec fixes (RES-13, RES-14). */
async function answering<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof InvalidSkillsError) {
      const problem: InvalidSkillsProblem = { ...problemFor(422, error.message), invalidSkillIds: error.invalidSkillIds };
      throw new ProblemDetailsException(problem);
    }
    if (error instanceof InvalidDatesError) {
      throw new ProblemDetailsException(problemFor(400, error.message, [{ path: 'endDate', code: 'custom' }]));
    }
    if (error instanceof OrderMismatchError) {
      throw new ProblemDetailsException(problemFor(400, error.message, [{ path: 'ids', code: 'invalid_order' }]));
    }
    if (error instanceof LimitReachedError) throw new ProblemDetailsException(problemFor(422, error.message));
    if (error instanceof ResumeNotFoundError) throw new ProblemDetailsException(problemFor(404, error.message));
    throw error;
  }
}

/** A `:section` that names no section answers `404`, before the body is looked at. */
function sectionOf(value: string): ResumeSection {
  const section = parseSection(value);
  if (section === undefined) throw new ProblemDetailsException(problemFor(404, 'Resume section not found'));
  return section;
}

/** A `:section` that has no bullets answers `404` too: only experiences and projects own them. */
function bulletSectionOf(value: string): BulletSection {
  const section = sectionOf(value);
  if (!isBulletSection(section)) throw new ProblemDetailsException(problemFor(404, 'Resume section has no bullets'));
  return section;
}

/** What a member does with the master resume; the admin has no use for these routes (AD-005, RES-30). */
@Controller('resume')
export class ResumeController {
  constructor(private readonly resume: ResumeService) {}

  @Roles('member')
  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<MasterResume> {
    return this.resume.get(user.id);
  }

  /** Declared with the other fixed paths, before any route that takes a `:section` segment. */
  @Roles('member')
  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser): Promise<ResumeSummary> {
    return this.resume.summary(user.id);
  }

  @Roles('member')
  @Put('profile')
  saveProfile(@Body(zodBody(saveProfileRequestSchema)) body: SaveProfileRequest, @CurrentUser() user: AuthenticatedUser): Promise<Profile> {
    return this.resume.saveProfile(user.id, body);
  }

  /** The body is checked by the schema of the section, the one the web uses to check the same fields (RES-11). */
  @Roles('member')
  @Post(':section')
  createItem(@Param('section') segment: string, @Body() body: unknown, @CurrentUser() user: AuthenticatedUser): Promise<ResumeItem> {
    const section = sectionOf(segment);
    const values = zodBody(createItemRequestSchemas[section]).transform(body, { type: 'body' }) as Record<string, unknown>;
    return answering(() => this.resume.createItem(user.id, section, values));
  }

  /** Only the fields sent are written; the schema is the partial one of the section (RES-08). */
  @Roles('member')
  @Patch(':section/:id')
  updateItem(
    @Param('section') segment: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResumeItem> {
    const section = sectionOf(segment);
    const values = zodBody(updateItemRequestSchemas[section]).transform(body, { type: 'body' }) as Record<string, unknown>;
    return answering(() => this.resume.updateItem(user.id, section, id, values));
  }

  @Roles('member')
  @HttpCode(204)
  @Delete(':section/:id')
  async deleteItem(@Param('section') segment: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    const section = sectionOf(segment);
    await answering(() => this.resume.deleteItem(user.id, section, id));
  }

  /** The whole section in the new order; the answer is the ids and nothing else (AD-028, RES-25). */
  @Roles('member')
  @Put(':section/order')
  orderItems(
    @Param('section') segment: string,
    @Body(zodBody(orderRequestSchema)) body: OrderRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderResponse> {
    return answering(() => this.resume.orderItems(user.id, sectionOf(segment), body.ids));
  }

  @Roles('member')
  @Post(':section/:id/bullets')
  createBullet(
    @Param('section') segment: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BulletResponse> {
    const section = bulletSectionOf(segment);
    const values = zodBody(createBulletRequestSchema).transform(body, { type: 'body' }) as CreateBulletRequest;
    return answering(() => this.resume.createBullet(user.id, section, id, values));
  }

  @Roles('member')
  @Patch(':section/:id/bullets/:bulletId')
  updateBullet(
    @Param('section') segment: string,
    @Param('id') id: string,
    @Param('bulletId') bulletId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BulletResponse> {
    const section = bulletSectionOf(segment);
    const values = zodBody(updateBulletRequestSchema).transform(body, { type: 'body' }) as UpdateBulletRequest;
    return answering(() => this.resume.updateBullet(user.id, section, id, bulletId, values));
  }

  @Roles('member')
  @HttpCode(204)
  @Delete(':section/:id/bullets/:bulletId')
  async deleteBullet(
    @Param('section') segment: string,
    @Param('id') id: string,
    @Param('bulletId') bulletId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const section = bulletSectionOf(segment);
    await answering(() => this.resume.deleteBullet(user.id, section, id, bulletId));
  }

  /** All the bullets of the item in the new order; the answer is the ids and nothing else (AD-028, RES-26). */
  @Roles('member')
  @Put(':section/:id/bullets/order')
  orderBullets(
    @Param('section') segment: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderResponse> {
    const section = bulletSectionOf(segment);
    const { ids } = zodBody(orderRequestSchema).transform(body, { type: 'body' }) as OrderRequest;
    return answering(() => this.resume.orderBullets(user.id, section, id, ids));
  }
}
