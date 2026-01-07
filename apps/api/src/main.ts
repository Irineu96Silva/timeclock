import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

function buildCors() {
  // Você pode controlar por env também, mas vou deixar seguro por padrão:
  const explicitOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Libera Vercel (preview e produção) e localhost
  const allowedRegexes: RegExp[] = [
    /^https:\/\/.*\.vercel\.app$/i, // qualquer projeto no vercel.app
    /^http:\/\/localhost:\d+$/i,
  ];

  // Se você tiver domínio próprio depois, adicione aqui:
  // allowedRegexes.push(/^https:\/\/seu-dominio\.com$/i);

  const allowOrigin = (origin?: string) => {
    // requests sem Origin (ex: healthcheck, curl) -> permite
    if (!origin) return true;

    // lista explícita via env (caso você queira travar só em 1 ou 2 origens)
    if (explicitOrigins.includes(origin)) return true;

    // regex (vercel/localhost)
    return allowedRegexes.some((re) => re.test(origin));
  };

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, ok?: boolean) => void) => {
      if (allowOrigin(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
      "Access-Control-Request-Method",
      "Access-Control-Request-Headers",
    ],
    exposedHeaders: ["Content-Disposition"],
    optionsSuccessStatus: 204, // importante p/ alguns browsers
    preflightContinue: false,
    maxAge: 86400,
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // logger: ["log", "error", "warn", "debug", "verbose"],
  });

  // Se você estiver atrás de proxy (Render), isso ajuda com algumas situações
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  // CORS tem que vir ANTES de listen
  app.enableCors(buildCors());

  // Se você usa prefixo:
  // app.setGlobalPrefix("api");

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");

  console.log(`API listening on ${port}`);
}

bootstrap();
