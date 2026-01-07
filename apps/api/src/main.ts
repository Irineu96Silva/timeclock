import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";

function parseCorsOrigins() {
  // Você pode controlar pelo Render com CORS_ORIGINS (csv)
  // Ex: https://timeclock-web.vercel.app,http://localhost:5173
  const raw = process.env.CORS_ORIGINS || "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Origens fixas (fallback)
  const defaults = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://timeclock-web.vercel.app",
  ];

  const all = Array.from(new Set([...defaults, ...list]));
  console.log("CORS allowed origins:", all);
  return all;
}

function isVercelPreview(origin: string) {
  // aceita tanto produção quanto previews do Vercel:
  // https://timeclock-web.vercel.app (produção)
  // https://timeclock-web-xxxx.vercel.app (previews)
  return /^https:\/\/timeclock-web(-.*)?\.vercel\.app$/.test(origin);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);



  const allowed = parseCorsOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      // requests server-to-server ou healthchecks sem Origin
      if (!origin) {
        console.log("CORS: Request without origin, allowing");
        return callback(null, true);
      }

      console.log(`CORS: Checking origin: ${origin}`);

      if (allowed.includes(origin)) {
        console.log(`CORS: Origin ${origin} is in allowed list`);
        return callback(null, true);
      }

      if (isVercelPreview(origin)) {
        console.log(`CORS: Origin ${origin} matches Vercel pattern`);
        return callback(null, true);
      }

      // bloqueia o que não estiver permitido
      console.error(`CORS: Blocked origin: ${origin}`);
      console.error(`CORS: Allowed origins:`, allowed);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
    exposedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: false,
    maxAge: 86400, // 24 horas
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, "0.0.0.0");

  console.log(`API listening on ${port}`);
}

bootstrap();
