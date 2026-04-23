import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const publicPath = join(__dirname, '..', 'public');
  app.useStaticAssets(publicPath);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 全局响应拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS 配置
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    console.warn(
      'WARNING: CORS_ORIGIN is not set, falling back to http://localhost:3000. Set it explicitly in production.',
    );
  }
  app.enableCors({
    origin: corsOrigin || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('URP API')
    .setDescription(
      'URP API 文档。成功响应统一包装为 { code, data, message }，错误响应统一包装为 { code, message, data: null }。',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
  console.log('Serving static files from:', publicPath);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `Demo pages available at: http://localhost:${process.env.PORT ?? 3000}/demo/login.html`,
  );
}
void bootstrap();
