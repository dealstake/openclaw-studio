import { registerOTel } from "@vercel/otel";

export const registerTracing = () => {
  registerOTel({ serviceName: "openclaw-studio" });
};
