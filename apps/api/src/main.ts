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
  return all;
}

function isVercelPreview(origin: string) {
  // aceita previews do Vercel do tipo:
  // https://timeclock-web-xxxx.vercel.app
  return /^https:\/\/timeclock-web-.*\.vercel\.app$/.test(origin);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);



  const allowed = parseCorsOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      // requests server-to-server ou healthchecks sem Origin
      if (!origin) return callback(null, true);

      if (allowed.includes(origin)) return callback(null, true);
      if (isVercelPreview(origin)) return callback(null, true);

      // bloqueia o que não estiver permitido
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: false,
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
