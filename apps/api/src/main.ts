import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, cb) => {
      const allowedOrigins = [
        "http://localhost:5173",
        "https://timeclock-web.vercel.app",
      ];

      // permite chamadas sem origin (ex: healthcheck, Postman)
      if (!origin) return cb(null, true);

      // permite localhost e seu domínio principal
      if (allowedOrigins.includes(origin)) return cb(null, true);

      // permite previews da Vercel (qualquer subdomínio *.vercel.app)
      if (origin.endsWith(".vercel.app")) return cb(null, true);

      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API listening on ${port}`);
}

bootstrap();
