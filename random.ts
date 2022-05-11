/*
Contains pieces of code copyrighted by David Bau. The copyrigth notice is as follows:

Copyright 2019 David Bau.
Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*
  Though heavily modified,
  it still resembles the original code,
  and was based out of it anyways
*/

const pool: number[] = [],
      width = 256,        // each RC4 output is 0 <= x < 256
      chunks = 6,         // at least six RC4 outputs for each double
      digits = 52,        // there are 52 significant digits in a double
      startdenom = width ** chunks,
      significance = 2 ** digits,
      overflow = significance * 2,
      mask = width - 1

export class SeedRandom {
  private readonly arc4: Arc4
  public readonly key: number[] = []

  constructor(seed: string, options?: { [x: string]: any } | boolean) {
    options = (options) ? { entropy: true } : (options || {})
    mixkey(flatten(options['entropy'] ? [seed, tostring(pool)] : seed, 3), this.key)
    this.arc4 = new Arc4(this.key)
    mixkey(tostring(this.arc4.S), pool);
  }

  prng() {
    let n = this.arc4.g(chunks),             // Start with a numerator n < 2 ^ 48
        d = startdenom,                 //   and denominator d = 2 ^ 48.
        x = 0;                          //   and no 'extra last byte'.
    while (n < significance) {          // Fill up all significant digits by
      n = (n + x) * width;              //   shifting numerator and
      d *= width;                       //   denominator and generating a
      x = this.arc4.g(1);                    //   new least-significant-byte.
    }
    while (n >= overflow) {             // To avoid rounding up, before adding
      n /= 2;                           //   last byte, shift everything
      d /= 2;                           //   right using integer math until
      x >>>= 1;                         //   we have exactly the desired bits.
    }
    return (n + x) / d;                 // Form the number within [0, 1).
  }
}

/**
 * ARC4
 * 
 * An ARC4 implementation.  The constructor takes a key in the form of
 * an array of at most (width) integers that should be 0 <= x < (width).
 * 
 * The g(count) method returns a pseudorandom integer that concatenates
 * the next (count) outputs from ARC4.  Its return value is a number x
 * that is in the range 0 <= x < (width ^ count).
 */
class Arc4 {
  public t?: number
  public i: number = 0
  public j: number = 0
  public S: number[] = []
  public s: number[] = []
  public keylen: number
  public key

  constructor(key: number[]) {
    this.keylen = key.length
    this.key = key

    // The empty key [] is treated as [0]
    if (!this.keylen) this.key = [ this.keylen++ ]

    // Set up S using the standard key sheduling algorithm
    while (this.i < width) {
      this.s[this.i] = this.i++
    }

    for (this.i = 0; this.i < width; this.i++) {
      this.t = this.s[this.i]
      this.j = mask & (this.j + key[this.i % this.keylen] + (this.t))
      this.s[this.i] = this.s[this.j]
    }

  }

  g(count: number): number {
    let t: number,
        r: number = 0,
        i: number = this.i,
        j: number = this.j,
        s: number[] = this.s;
    
    while (count--) {
      i = mask & (i + 1)
      t = s[i]
      j = mask & (j + t)
      s[i] = s[j]
      s[j] = t
      r = r * width + s[mask & (s[i] + s[j])]
    }
    this.i = i
    this.j = j
    return r
  }
}

/**
 * Converts an array of charcodes to a string
 * @param a
 * @returns 
 */
function tostring(a: number[]) {
  return String.fromCharCode.apply(0, a);
}

/**
 * Converts an object tree to nested arrays of strings.
 * @param obj
 * @param depth
 */
function flatten(obj: any, depth: number): string {
  const typ = (typeof obj);
  let result: any[] = [], prop;

  if (depth && typ == 'object') {
    for (prop in obj) {
      try { result.push(flatten(obj[prop], depth - 1)); } catch (e) {}
    }
  }
  obj = (typ == 'string' ? obj : obj + '\0')
  return result.length ? result : obj;
}

/**
 * Mixes a string seed into a key that is an array of integers, and
 * returns a shortened string seed that is equivalent to the result key.
 * @param seed 
 * @param key
 */
function mixkey(seed: string, key: number[]): string {
  let stringseed = seed + '', smear = 0, j = 0;
  while (j < stringseed.length) {
    smear ^= key[mask & j] * 19
    key[mask & j] = mask & (smear + stringseed.charCodeAt(j++));
  }
  return tostring(key);
}


namespace Bind {
  export type Fnc = (...args: any[]) => any
  export type Obj = object
  export type Return<f extends Fnc, o extends Obj> = ((...args: Parameters<f>) => ReturnType<f>) & o
  export type F <f extends Fnc> = { to: <o extends Obj>(obj: o) => Bind.Return<f, o> }
}

/**
 * Bind a function to the base of a class, letting you do something like `Foo()`, where `Foo` is a class
 * @param fnc A function to bind to an object
 * @returns A function with the parameter:
 * @param obj The object to bind to the function
 * @returns An object with the desired function
 */
export function bind<f extends Bind.Fnc>(fnc: f): Bind.F<f> {
  return {
    to: function <o extends Bind.Obj>(obj: o): Bind.Return<f, o> {
      return Object.setPrototypeOf(fnc.bind(obj), obj)
    }
  }
}