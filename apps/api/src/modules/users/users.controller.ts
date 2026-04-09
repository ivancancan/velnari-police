// apps/api/src/modules/users/users.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, CreateUserDto, UpdateUserDto } from '@velnari/shared-types';
import type { UserEntity } from '../../entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<UserEntity[]> {
    return this.service.findAll(
      parseInt(limit as string) || 50,
      parseInt(offset as string) || 0,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserEntity> {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<UserEntity> {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserEntity> {
    return this.service.update(id, dto);
  }
}
