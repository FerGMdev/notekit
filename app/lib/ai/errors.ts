export class AiQuotaError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(
      `You reached the daily AI limit of ${limit} requests. Try again tomorrow, or keep using the built-in provider.`
    );
    this.name = "AiQuotaError";
    this.limit = limit;
  }
}
