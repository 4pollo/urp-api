import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './auth-request.interface';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: '注册用户' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiOperation({ summary: '用户登录' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @ApiUnauthorizedResponse({ description: '邮箱或密码错误。' })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiOperation({ summary: '刷新访问令牌' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @ApiUnauthorizedResponse({ description: '刷新令牌无效。' })
  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @ApiOperation({ summary: '用户登出' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: '未提供或提供了无效的 JWT。' })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: AuthenticatedRequest) {
    return this.authService.logout(req.user.userId);
  }

  @ApiOperation({ summary: '修改当前用户密码' })
  @ApiBearerAuth()
  @ApiBadRequestResponse({ description: '请求参数校验失败，或新旧密码相同。' })
  @ApiUnauthorizedResponse({ description: '未提供或提供了无效的 JWT。' })
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, changePasswordDto);
  }

  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: '未提供或提供了无效的 JWT。' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user.userId);
  }
}
