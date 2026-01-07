// apps/api/src/main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ CORS (Vercel + Dev local)
  // IMPORTANT: se você usar cookies/refresh em cookie, mantenha credentials: true
  app.enableCors({
    origin: [
      "https://timeclock-web.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  // (Opcional) Se você usa proxy (Render/Cloudflare) e quer IP real:
  // app.set("trust proxy", 1);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  // Se quiser logar a URL:
  // console.log(`API listening on ${port}`);
}

bootstrap();
