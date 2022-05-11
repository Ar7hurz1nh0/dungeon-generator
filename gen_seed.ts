type position = [number, number]
type Orientation = 'N' | 'E' | 'S' | 'W'
type binary = 0 | 1
type RoomDisplay = string
type RoomTypes = "base" | "puzzle" | "boss" | "miniboss" | "combat" | "lore" | "shop" | "bonus" | "exit"
type exits = [binary, binary, binary, binary]
type ExitMax = 1 | 2 | 3 | 4
type SeedInterface = SeedRandom
interface ConstructableRoom<T extends RoomSpec> {
  maxSize: number;
  minSize: number;
  new(...args: any) : T;
}

import { SeedRandom } from './random'

interface PreRoom {
  height: number
  width: number
  id: string
  seed: SeedInterface
}

interface RoomInit extends PreRoom {
  position: position
  maxExits: ExitMax
}

interface Room extends RoomInit {
  exits: exits
}

interface LevelInit {
  seed: string
  puzzle: number
  miniboss: number
  combat: number
  lore: number
  shop: number
  hasBoss: boolean
}

abstract class RoomSpec {
  public static readonly type: RoomTypes
  public static readonly canConnectTo: RoomTypes[]
  public static readonly maxSize: number
  public static readonly minSize: number
  public readonly height: number
  public readonly width: number
  public readonly position: position
  public readonly id: string
  public readonly maxExits: ExitMax
  public readonly exits: exits = [0, 0, 0, 0]
  public readonly seed: SeedInterface

  public constructor(stats: RoomInit) {
    this.height = stats.height
    this.width = stats.width
    this.position = stats.position
    this.id = stats.id
    this.maxExits = stats.maxExits
    this.seed = stats.seed
  }
}

interface CorridorConnect {
  room: RoomSpec
  connectsBy: Orientation
}

class Level {
  private matrix: RoomDisplay[][] = []
  public readonly rooms: RoomSpec[] = []
  private readonly preGenRooms: PreRoom[] = []
  public readonly serializedSeed: SeedInterface
  public roomsNumber: number = 2

  public readonly hasBoss: boolean

  public constructor(stats: LevelInit) {
    this.serializedSeed = new SeedRandom(stats.seed)
    this.genPreRoom(stats.puzzle, Puzzle)
    this.genPreRoom(stats.combat, Combat)
    this.genPreRoom(stats.lore, Lore)
    this.genPreRoom(stats.shop, Shop)
    this.genPreRoom(stats.miniboss, Miniboss)
    this.hasBoss = stats.hasBoss

    for (const i in stats) {
      if (typeof i === 'number') this.roomsNumber += i 
    }

    this.rooms.push(new Base({
      width: this.genNumber(Base.minSize, Base.maxSize, this.seed),
      height: this.genNumber(Base.minSize, Base.maxSize, this.seed),
      seed: this.serializedSeed,
      id: this.id,
      maxExits: 1,
      position: [0, 0]
    }))

    while (this.preGenRooms.length) {
      const roomIndex = ((): RoomSpec => {
        while (true) { break }
        return this.rooms[0]
      })()
      const preIndex = this.genNumber(0, this.preGenRooms.length, this.seed)
      const o = this.genIndex(this.genNumber(0, 3, this.seed))
      
      console.log(preIndex, o)
      this.preGenRooms.splice(preIndex, 1)
    }

    return;
    if (this.hasBoss) {
      this.rooms.push(new Boss({
        width: this.genNumber(Boss.minSize, Boss.maxSize, this.seed),
        height: this.genNumber(Boss.minSize, Boss.maxSize, this.seed),
        id: this.id,
        maxExits: 1,
        position: [0, 0],
        seed: this.serializedSeed
      }))
    }
    else {
      this.rooms.push(new Exit({
        width: this.genNumber(Exit.minSize, Base.maxSize, this.seed),
        height: this.genNumber(Exit.minSize, Exit.maxSize, this.seed),
        id: this.id,
        maxExits: 1,
        position: [0, 0],
        seed: this.serializedSeed
      }))
    }
  }

  public set createMatrix(n: number) {
    const m: RoomDisplay[][] = []
    for (let i = 0; i < n; i++) {
      m.push([])
      for (let j = 0; j < n; j++) { 
        m[i].push('*')
      }
    }
    this.matrix = m
  }

  public get render(): string {
    const add = (i: RoomDisplay) => display += i
    let display = ""
    for (const i of this.matrix) {
      for (const j of i) {
        add(j)
      }
      display += "\n"
    }
    return display//.split("").map(i => i.replace("*", " ")).join("")
  }

  public get seed(): number {
    return this.serializedSeed.prng()
  }

  private get id(): string {
    return (this.seed * 0xffff).toString(16).split('.')[0].toUpperCase()
  }

  private getMatrixSize(): number {
    let width = 0,
        height = 0
    for (const room of this.rooms) {
      if (room.width > width) width = room.width
      if (room.height > height) height = room.height
    }
    return width > height ? width : height
  }

  public genNumber(min: number, max: number, base?: number): number {
    return Math.floor((base || Math.random()) * (max - min + 1)) + min
  }

  public genExit(exits: exits, min: ExitMax = 1, max: ExitMax = 3): exits {
    const sum: number = exits.reduce((a: number, b: number) => a + b, 0)
    if (sum > max) return exits
    let exit: exits
    do {
      exit = [
        exits[0] ? 1 : this.genNumber(0, 1, this.seed) as binary,
        exits[1] ? 1 : this.genNumber(0, 1, this.seed) as binary,
        exits[2] ? 1 : this.genNumber(0, 1, this.seed) as binary,
        exits[3] ? 1 : this.genNumber(0, 1, this.seed) as binary
      ]
    } while (exit.filter(e => e === 1).length < min || exit.filter(e => e === 1).length > max)
    return exit
  }

  public getIndex(str: Orientation): number {
    switch(str) {
      case 'N': return 0
      case 'E': return 1
      case 'S': return 2
      case 'W': return 3
    }
  }

  public genIndex(str: number): Orientation {
    switch(str) {
      case 0: return 'N'
      case 1: return 'E'
      case 2: return 'S'
      case 3: return 'W'
      default: throw new Error()
    }
  }

  private genPreRoom<n extends number, r extends ConstructableRoom<RoomSpec>>(maxRooms: n, roomType: r): void {
    for (let i = 0; i < maxRooms; i++) {
      this.preGenRooms.push(new roomType({
        width: this.genNumber(roomType.minSize, roomType.maxSize, this.seed),
        height: this.genNumber(roomType.minSize, roomType.maxSize, this.seed),
        seed: this.serializedSeed,
        id: this.id,
        maxExits: null,
        position: null
      }))
    }
  }

  public getCoordinates(initialPos: position, orientation: Orientation): position {
    switch(orientation) {
      case 'N': return [initialPos[0], initialPos[1] - 1]
      case 'E': return [initialPos[0] + 1, initialPos[1]]
      case 'S': return [initialPos[0], initialPos[1] + 1]
      case 'W': return [initialPos[0] - 1, initialPos[1]]
    }
  }
}

class Base extends RoomSpec {
  
  public static override readonly type: RoomTypes = "base"
  public static override readonly maxSize: number = 15;
  public static override readonly minSize: number = 9;
  public static override readonly canConnectTo: RoomTypes[] = ["puzzle", "combat", "lore"]
  constructor(init: RoomInit) {
    super(init)
  }
}

class Puzzle extends RoomSpec {
  public static override readonly type: RoomTypes = "puzzle"
  public static override readonly maxSize: number = 27;
  public static override readonly minSize: number = 15;
  public static override readonly canConnectTo: RoomTypes[] = ["base", "boss", "miniboss", "combat", "lore", "shop", "bonus"]
  constructor(init: RoomInit) {
    super(init)
  }
}

class Boss extends RoomSpec {
  public static override readonly type: RoomTypes = "boss"
  public static override readonly maxSize: number = 35;
  public static override readonly minSize: number = 25;
  public static override readonly canConnectTo: RoomTypes[] = ["combat", "lore", "shop", "bonus"]
  constructor(init: RoomInit) {
    super(init)
  }
}

class Exit extends RoomSpec {
  public static override readonly type: RoomTypes = "exit"
  public static override readonly maxSize: number = 25;
  public static override readonly minSize: number = 15;
  public static override readonly canConnectTo: RoomTypes[] = ["combat", "lore", "shop"]
  constructor(init: RoomInit) {
    super(init)
  }
}

class Miniboss extends RoomSpec {
  public static override readonly type: RoomTypes = "miniboss"
  public static override readonly maxSize: number = 27;
  public static override readonly minSize: number = 23;
  public static override readonly canConnectTo: RoomTypes[] = ["combat", "lore", "shop", "bonus"]
  constructor(init: RoomInit) {
    super(init)
  }
}

class Combat extends RoomSpec {
  public static override readonly type: RoomTypes = "combat"
  public static override readonly maxSize: number = 23;
  public static override readonly minSize: number = 13;
  public static override readonly canConnectTo: RoomTypes[] = ["base", "boss", "miniboss", "combat", "combat", "lore", "shop", "bonus"]
  constructor(init: RoomInit) {
    super(init)
  }
}

class Lore extends RoomSpec {
  public static override readonly type: RoomTypes = "lore"
  public static override readonly maxSize: number = 13;
  public static override readonly minSize: number = 9;
  public static override readonly canConnectTo: RoomTypes[] = ["base", "boss", "miniboss", "combat", "combat", "bonus"]
  constructor(init: RoomInit) {
    super(init)
  }
}

class Shop extends RoomSpec {
  public static override readonly type: RoomTypes = "shop"
  public static override readonly maxSize: number = 17;
  public static override readonly minSize: number = 13;
  public static override readonly canConnectTo: RoomTypes[] = ["base", "boss", "miniboss", "combat", "combat", "bonus"]
  constructor(init: RoomInit) {
    super(init)
  }
}

class Bonus extends RoomSpec {
  public static override readonly type: RoomTypes = "bonus"
  public static override readonly maxSize: number = 17;
  public static override readonly minSize: number = 9;
  public static override readonly canConnectTo: RoomTypes[] = ["boss"]
  constructor(init: RoomInit) {
    super(init)
  }
}

const Level1 = new Level({
  combat: 3,
  lore: 1,
  shop: 0,
  miniboss: 0,
  puzzle: 2,
  hasBoss: false,
  seed: 'hello.'
})

console.log(Level1)

// homiranha nunca bate só apanha! <3 
// Pedro Thiago, eu te amooo!!!
// Quis fugir de mim mesmo, mas onde eu ia, eu tava
// coração: meu amigo se vc não parar, eu paro
// Reage mulher! Bota um cropped. Vamos galera, mulheres! 