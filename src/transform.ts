type Primitive = string | number | bigint | boolean

type TokenType = "number" | "identifier" | "operator" | "punctuation" | "eof"

interface Token {
  type: TokenType
  value: string
  position: number
}

const ALLOWED_MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  acos: Math.acos,
  acosh: Math.acosh,
  asin: Math.asin,
  asinh: Math.asinh,
  atan: Math.atan,
  atan2: Math.atan2,
  atanh: Math.atanh,
  cbrt: Math.cbrt,
  ceil: Math.ceil,
  clz32: Math.clz32,
  cos: Math.cos,
  cosh: Math.cosh,
  exp: Math.exp,
  expm1: Math.expm1,
  floor: Math.floor,
  fround: Math.fround,
  hypot: Math.hypot,
  imul: Math.imul,
  log: Math.log,
  log10: Math.log10,
  log1p: Math.log1p,
  log2: Math.log2,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sign: Math.sign,
  sin: Math.sin,
  sinh: Math.sinh,
  sqrt: Math.sqrt,
  tan: Math.tan,
  tanh: Math.tanh,
  trunc: Math.trunc,
}

const ALLOWED_MATH_CONSTANTS: Record<string, number> = {
  E: Math.E,
  LN10: Math.LN10,
  LN2: Math.LN2,
  LOG10E: Math.LOG10E,
  LOG2E: Math.LOG2E,
  PI: Math.PI,
  SQRT1_2: Math.SQRT1_2,
  SQRT2: Math.SQRT2,
}

class Lexer {
  private position = 0

  public constructor(private expression: string) {}

  public next(): Token {
    this.skipWhitespace()

    if (this.position >= this.expression.length) {
      return { type: "eof", value: "", position: this.position }
    }

    const start = this.position
    const current = this.expression[this.position]

    if (/[0-9]/.test(current) || (current === "." && /[0-9]/.test(this.expression[this.position + 1] ?? ""))) {
      return this.readNumber()
    }

    if (/[A-Za-z_$]/.test(current)) {
      return this.readIdentifier()
    }

    const operators = ["===", "!==", "**", "<=", ">=", "==", "!=", "&&", "||"]
    for (const operator of operators) {
      if (this.expression.startsWith(operator, this.position)) {
        this.position += operator.length
        return { type: "operator", value: operator, position: start }
      }
    }

    if ("+-*/%<>!".includes(current)) {
      this.position += 1
      return { type: "operator", value: current, position: start }
    }

    if ("(),.?:".includes(current)) {
      this.position += 1
      return { type: "punctuation", value: current, position: start }
    }

    throw new Error(
      `Unsupported token '${current}' at position ${start} in transform`,
    )
  }

  private skipWhitespace() {
    while (
      this.position < this.expression.length &&
      /\s/.test(this.expression[this.position])
    ) {
      this.position += 1
    }
  }

  private readNumber(): Token {
    const start = this.position
    const rest = this.expression.slice(this.position)
    const match = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)

    if (!match) {
      throw new Error(`Invalid number at position ${start} in transform`)
    }

    this.position += match[0].length
    return { type: "number", value: match[0], position: start }
  }

  private readIdentifier(): Token {
    const start = this.position
    const rest = this.expression.slice(this.position)
    const match = rest.match(/^[A-Za-z_$][A-Za-z0-9_$]*/)

    if (!match) {
      throw new Error(`Invalid identifier at position ${start} in transform`)
    }

    this.position += match[0].length
    return { type: "identifier", value: match[0], position: start }
  }
}

class Parser {
  private current: Token

  public constructor(
    expression: string,
    private inputValue: string | number | bigint,
  ) {
    const trimmed = expression.trim()
    if (!trimmed) throw new Error("Transform expression cannot be empty")
    if (trimmed.length > 512) {
      throw new Error("Transform expression exceeds 512 characters")
    }

    this.lexer = new Lexer(trimmed)
    this.current = this.lexer.next()
  }

  private lexer: Lexer

  public parse(): Primitive {
    const value = this.parseConditional()
    this.expect("eof")
    return value
  }

  private parseConditional(): Primitive {
    const condition = this.parseLogicalOr()

    if (this.matchPunctuation("?")) {
      const whenTrue = this.parseConditional()
      this.expectPunctuation(":")
      const whenFalse = this.parseConditional()
      return this.truthy(condition) ? whenTrue : whenFalse
    }

    return condition
  }

  private parseLogicalOr(): Primitive {
    let left = this.parseLogicalAnd()

    while (this.matchOperator("||")) {
      const right = this.parseLogicalAnd()
      left = this.truthy(left) ? left : right
    }

    return left
  }

  private parseLogicalAnd(): Primitive {
    let left = this.parseEquality()

    while (this.matchOperator("&&")) {
      const right = this.parseEquality()
      left = this.truthy(left) ? right : left
    }

    return left
  }

  private parseEquality(): Primitive {
    let left = this.parseComparison()

    while (
      this.isOperator("==") ||
      this.isOperator("!=") ||
      this.isOperator("===") ||
      this.isOperator("!==")
    ) {
      const operator = this.current.value
      this.advance()
      const right = this.parseComparison()

      switch (operator) {
        case "==":
          left = left == right
          break
        case "!=":
          left = left != right
          break
        case "===":
          left = left === right
          break
        case "!==":
          left = left !== right
          break
      }
    }

    return left
  }

  private parseComparison(): Primitive {
    let left = this.parseAdditive()

    while (
      this.isOperator("<") ||
      this.isOperator("<=") ||
      this.isOperator(">") ||
      this.isOperator(">=")
    ) {
      const operator = this.current.value
      this.advance()
      const right = this.parseAdditive()

      switch (operator) {
        case "<":
          left = left < right
          break
        case "<=":
          left = left <= right
          break
        case ">":
          left = left > right
          break
        case ">=":
          left = left >= right
          break
      }
    }

    return left
  }

  private parseAdditive(): Primitive {
    let left = this.parseMultiplicative()

    while (this.isOperator("+") || this.isOperator("-")) {
      const operator = this.current.value
      this.advance()
      const right = this.parseMultiplicative()

      if (operator === "+") {
        left = (left as any) + (right as any)
      } else {
        left = (left as any) - (right as any)
      }
    }

    return left
  }

  private parseMultiplicative(): Primitive {
    let left = this.parseExponent()

    while (
      this.isOperator("*") ||
      this.isOperator("/") ||
      this.isOperator("%")
    ) {
      const operator = this.current.value
      this.advance()
      const right = this.parseExponent()

      switch (operator) {
        case "*":
          left = (left as any) * (right as any)
          break
        case "/":
          left = (left as any) / (right as any)
          break
        case "%":
          left = (left as any) % (right as any)
          break
      }
    }

    return left
  }

  private parseExponent(): Primitive {
    let left = this.parseUnary()

    if (this.matchOperator("**")) {
      const right = this.parseExponent()
      left = (left as any) ** (right as any)
    }

    return left
  }

  private parseUnary(): Primitive {
    if (this.matchOperator("+")) {
      return +(this.parseUnary() as any)
    }
    if (this.matchOperator("-")) {
      return -(this.parseUnary() as any)
    }
    if (this.matchOperator("!")) {
      return !this.truthy(this.parseUnary())
    }

    return this.parsePrimary()
  }

  private parsePrimary(): Primitive {
    if (this.current.type === "number") {
      const token = this.current
      this.advance()
      return Number(token.value)
    }

    if (this.current.type === "identifier") {
      const token = this.current
      this.advance()

      if (token.value === "value") {
        return this.inputValue
      }

      if (token.value === "true") return true
      if (token.value === "false") return false

      if (token.value === "Math") {
        return this.parseMathMember()
      }

      throw new Error(
        `Identifier '${token.value}' is not allowed in transforms`,
      )
    }

    if (this.matchPunctuation("(")) {
      const value = this.parseConditional()
      this.expectPunctuation(")")
      return value
    }

    throw new Error(
      `Unexpected token '${this.current.value}' at position ${this.current.position} in transform`,
    )
  }

  private parseMathMember(): Primitive {
    this.expectPunctuation(".")

    if (this.current.type !== "identifier") {
      throw new Error("Expected an allowed Math member in transform")
    }

    const member = this.current.value
    this.advance()

    if (Object.prototype.hasOwnProperty.call(ALLOWED_MATH_CONSTANTS, member)) {
      if (this.isPunctuation("(")) {
        throw new Error(`Math.${member} is a constant, not a function`)
      }
      return ALLOWED_MATH_CONSTANTS[member]
    }

    if (!Object.prototype.hasOwnProperty.call(ALLOWED_MATH_FUNCTIONS, member)) {
      throw new Error(`Math.${member} is not allowed in transforms`)
    }
    const fn = ALLOWED_MATH_FUNCTIONS[member]

    this.expectPunctuation("(")
    const args: any[] = []

    if (!this.isPunctuation(")")) {
      while (true) {
        const arg = this.parseConditional()
        args.push(arg)
        if (!this.matchPunctuation(",")) break
      }
    }

    this.expectPunctuation(")")
    return fn(...args)
  }

  private truthy(value: Primitive) {
    return Boolean(value)
  }

  private advance() {
    this.current = this.lexer.next()
  }

  private isOperator(value: string) {
    return this.current.type === "operator" && this.current.value === value
  }

  private matchOperator(value: string) {
    if (!this.isOperator(value)) return false
    this.advance()
    return true
  }

  private isPunctuation(value: string) {
    return this.current.type === "punctuation" && this.current.value === value
  }

  private matchPunctuation(value: string) {
    if (!this.isPunctuation(value)) return false
    this.advance()
    return true
  }

  private expectPunctuation(value: string) {
    if (!this.matchPunctuation(value)) {
      throw new Error(
        `Expected '${value}' at position ${this.current.position} in transform`,
      )
    }
  }

  private expect(type: TokenType) {
    if (this.current.type !== type) {
      throw new Error(
        `Unexpected token '${this.current.value}' at position ${this.current.position} in transform`,
      )
    }
  }
}

export function evaluateTransform(
  expression: string,
  value: string | number | bigint,
): Primitive {
  return new Parser(expression, value).parse()
}
