export class SensorUnavailableError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = "SensorUnavailableError"
  }
}
