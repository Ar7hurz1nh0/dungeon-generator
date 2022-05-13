type position = [number, number]
type Orientation = 'N' | 'E' | 'S' | 'W'
type RoomDisplay = string
type RoomTypes = "base" | "puzzle" | "boss" | "miniboss" | "combat" | "lore" | "shop" | "bonus" | "exit"
type exits = [boolean, boolean, boolean, boolean]
type ExitMax = 1 | 2 | 3 | 4
type SeedInterface = SeedRandom
type Difficulty = { [x in RoomTypes]: number }
interface ConstructableRoom<T extends RoomSpec> {
  readonly type: RoomTypes
  readonly canConnectTo: RoomTypes[]
  readonly maxSize: number
  readonly minSize: number
  new(...args: any): T;
}

import { SeedRandom } from './random'

interface RoomInit {
  readonly position: position
  readonly height: number
  readonly width: number
  readonly id: string
  readonly seed: SeedInterface
}

interface RoomPos {
  readonly position: position
  readonly width: number
  readonly height: number
}

interface LevelInit {
  readonly seed: string
  readonly level: number
  readonly difficulty: number
  readonly hasBoss: boolean
}

abstract class RoomSpec {
  public static readonly type: RoomTypes
  public readonly type: RoomTypes = RoomSpec.type
  public static readonly canConnectTo: RoomTypes[]
  public readonly canConnectTo: RoomTypes[] = RoomSpec.canConnectTo
  public static readonly maxSize: number
  public readonly maxSize: number = RoomSpec.maxSize
  public static readonly minSize: number
  public readonly minSize: number = RoomSpec.minSize
  public readonly height: number
  public readonly width: number
  public readonly position: position
  public readonly id: string
  public readonly exits: exits = [false, false, false, false]
  public readonly seed: SeedInterface

  public constructor(stats: RoomInit) {
    this.height = stats.height
    this.width = stats.width
    this.position = stats.position
    this.id = stats.id
    this.seed = stats.seed
  }
}

interface CorridorConnect {
  readonly orientation: Orientation
  readonly connectsBy: string // Room ID
  readonly connectsTo: string // Room ID
  readonly startsOn: position
  readonly endsOn: position
}

export default class Level {
  private matrix: RoomDisplay[][] = []
  public readonly rooms: RoomSpec[] = []
  public readonly corridors: CorridorConnect[] = []
  private readonly preGenRooms: ConstructableRoom<RoomSpec>[] = []
  public readonly serializedSeed: SeedInterface
  public roomsNumber: number = 2
  public readonly level: number
  public readonly difficulty: Difficulty = {
    combat: 20,
    lore: 4,
    puzzle: 20,
    shop: 2,
    miniboss: 1,
    base: 0,
    bonus: 0,
    boss: 0,
    exit: 0
  }
  public readonly hasBoss: boolean

  public constructor(init: LevelInit) {
    this.serializedSeed = new SeedRandom(init.seed)
    this.level = init.level
    this.hasBoss = init.hasBoss;
    this.genPreRooms(this.genNumber(6, 10))

    console.log(this.preGenRooms)

    this.rooms.push(new Base({
      width: this.genNumber(Base.minSize, Base.maxSize),
      height: this.genNumber(Base.minSize, Base.maxSize),
      position: [0, 0],
      seed: this.serializedSeed,
      id: this.id,
    }))

    const collisionMatrix = this.collisionMatrix
    console.log(this.renderCollisionMatrix(collisionMatrix.matrix))

    this.rooms.push(this.connectPreRoom(Combat, { ori: 'E', room: this.rooms[0] }))
    
    this.rooms.push(this.connectPreRoom(Combat, { ori: 'S', room: this.rooms[1] }))
    
    this.rooms.push(this.connectPreRoom(Combat, { ori: 'E', room: this.rooms[1] }))
    
    this.rooms.push(this.connectPreRoom(Exit, { ori: 'N', room: this.rooms[1] }))
    

    console.log(this.renderCollisionMatrix(this.collisionMatrix.matrix))

    while (this.preGenRooms.length) {
      // TODO: roomIndex should get a room that do not have its maxExits exceeded
      // const roomIndex = this.rooms[0]
      const preIndex = this.genNumber(0, this.preGenRooms.length)
      const orientation = this.genOrientation(this.genNumber(0, 3))
      
      console.log(preIndex, orientation)
      this.preGenRooms.splice(preIndex, 1)
    }
  }

  public set createMatrix(n: number) {
    const m: RoomDisplay[][] = []
    for (let i = 0; i < n; i++) {
      m.push([])
      for (let j = 0; j < n; j++)
        m[i].push('*')
    }
    this.matrix = m
  }

  public get render(): string {
    const add = (i: RoomDisplay) => display += i
    let display = ""
    for (const i of this.matrix) {
      for (const j of i)
        add(j)
      display += "\n"
    }
    return display//.split("").map(i => i.replace("*", " ")).join("")
  }

  private doesCollide(room: RoomPos, { offset, matrix }: { offset: position, matrix: boolean[][] }): boolean {
    const width = room.position[0] + offset[0]
    const height = room.position[1] + offset[1]
    for (let w = width -1; w < width + room.width +1; w++) {
      if (w >= matrix.length || w < 0) continue;
      for (let h = height -1; h < height + room.height +1; h++) {
        if (h >= matrix[w].length || h < 0) continue;
        if (matrix[h][w]) return true
      }
    }
    return false
  }

  public renderCollisionMatrix(m: boolean[][]): string {
    const add = (i: RoomDisplay) => display += i
    let display = ""
    for (const i of m) {
      for (const j of i)
        add(j ? 'TT' : '  ')
      display += "\n"
    }
    return display//.split("").map(i => i.replace("*", " ")).join("")
  }
  
  private createCollisionMatrix(n: number): boolean[][] {
    const m: boolean[][] = []
    for (let i = 0; i < n; i++) {
      m.push([])
      for (let j = 0; j < n; j++)
        m[i].push(false)
    }
    return m
  }

  private get collisionMatrix(): { matrix: boolean[][], offset: position } {
    const [[minHeight],[minWidth]] = this.sizes;
    const matrix: boolean[][] = this.createCollisionMatrix(this.matrixSize)
    const heightOffset = minHeight * -1
    const widthOffset = minWidth * -1

    for (const room of this.rooms) {
      const width = room.position[0]  + room.width + widthOffset;
      const height = room.position[1] + room.height + heightOffset;

      for (let w = widthOffset + room.position[0]; w < width; w++) 
        for (let h = heightOffset + room.position[1]; h < height; h++)
          matrix[h][w] = true
      }

    return { matrix, offset: [widthOffset, heightOffset] }
  }

  public get seed(): number {
    return this.serializedSeed.prng()
  }

  private get id(): string {
    return (this.seed * 0xffff).toString(16).split('.')[0].toUpperCase()
  }

  private get sizes(): [position, position] {
    let minWidth = 0, maxWidth = 0,
        minHeight = 0, maxHeight = 0;
    for (const room of this.rooms) {
      const width = room.position[0] + room.width;
      const height = room.position[1] + room.height;
      if (width > maxWidth) maxWidth = width;
      if (height > maxHeight) maxHeight = height;
      if (room.position[0] < minWidth) minWidth = room.position[0];
      if (room.position[1] < minHeight) minHeight = room.position[1];
    }
    return [[minHeight, maxHeight],[minWidth, maxWidth]]
  }

  private get matrixSize(): number {
    const [[minHeight, maxHeight],[minWidth, maxWidth]] = this.sizes;
    let width = maxWidth, height = maxHeight;
    if (minWidth < 0) width -= minWidth;
    if (minHeight < 0) height -= minHeight; 
    return width > height ? width : height
  }

  public paintCorridor({ connectsBy, connectsTo, endsOn, orientation, startsOn }: CorridorConnect): CorridorConnect {
    return  {
      connectsBy, connectsTo,
      endsOn, startsOn,
      orientation
    }
  }

  public genNumber(min: number, max: number): number {
    const min2: number = min
    if (min < 0) { max += min * -1; min = 0; }
    return (this.seed * (max - min + 1) + min2) >> 0
  }

  public genExit(exits: exits, min: ExitMax = 1, max: ExitMax = 3): exits {
    let sum: number = 0
    exits.forEach((a: boolean) => { if(a) sum++ })
    if (sum > max) return exits
    let exit: exits
    do {
      exit = [
        exits[0] ? true : Boolean(this.genNumber(0, 1)),
        exits[1] ? true : Boolean(this.genNumber(0, 1)),
        exits[2] ? true : Boolean(this.genNumber(0, 1)),
        exits[3] ? true : Boolean(this.genNumber(0, 1))
      ]
    } while (exit.filter(e => e === true).length < min || exit.filter(e => e === true).length > max)
    return exit
  }

  public genOrientation(str: number): Orientation {
    switch(str) {
      case 0: return 'N'
      case 1: return 'E'
      case 2: return 'S'
      case 3: return 'W'
      default: throw new Error()
    }
  }

  private connectPreRoom<R extends ConstructableRoom<RoomSpec>>(room: R, ref: { ori: Orientation, room: RoomPos }): RoomSpec {
    const position: position = [...ref.room.position]
    console.log(position)
    const width = this.genNumber(room.minSize, room.maxSize)
    const height = this.genNumber(room.minSize, room.maxSize)
    if (ref) {
      switch(ref.ori) {
        case 'N': {
          const pos = this.genNumber(ref.room.width - width, width - ref.room.width) * -1
          position[0] += pos
          console.log('N', pos, ref.room.width - width, width - ref.room.width)
          position[1] = ref.room.position[1] -1;
          let collision = this.collisionMatrix
          while(this.doesCollide({ position, width, height }, collision)) { position[1] -= 1; collision = this.collisionMatrix }
          break;
        }
        case 'E': {
          const pos = this.genNumber(ref.room.height - height, height - ref.room.height) * -1
          position[1] += pos
          console.log('E', pos, ref.room.height - height, height - ref.room.height)
          position[0] = ref.room.position[0] +1;
          let collision = this.collisionMatrix
          while(this.doesCollide({ position, width, height }, collision)) { position[0] += 1; collision = this.collisionMatrix }
          break;
        }
        case 'S': {
          const pos = this.genNumber(ref.room.width - width, width - ref.room.width) * -1
          position[0] += pos
          console.log('S', pos, ref.room.width - width, width - ref.room.width)
          position[1] = ref.room.position[1] +1;
          let collision = this.collisionMatrix
          while(this.doesCollide({ position, width, height }, collision)) { position[1] += 1; collision = this.collisionMatrix }
          break;
        }
        case 'W': {
          const pos = this.genNumber(ref.room.height - height, height - ref.room.height) * -1
          position[1] += pos
          console.log('W', pos, ref.room.height - height, height - ref.room.height)
          position[0] = ref.room.position[0] -1;
          let collision = this.collisionMatrix
          while(this.doesCollide({ position, width, height }, collision)) { position[0] -= 1; collision = this.collisionMatrix }
          break;
        }
      }
    }
    return new room({
      width,
      height,
      position,
      seed: this.serializedSeed,
      id: this.id
    })
  }

  private genPreRooms(maxRooms: number): void {
    const rooms: Array<ConstructableRoom<RoomSpec>> = []
    for (const i in this.difficulty) {
      if(i === Combat.type) for(let q = 0; q < this.difficulty[i]; q++) rooms.push(Combat)
      if(i === Lore.type) for(let q = 0; q < this.difficulty[i]; q++) rooms.push(Lore)
      if(i === Puzzle.type) for(let q = 0; q < this.difficulty[i]; q++) rooms.push(Puzzle)
      if(i === Shop.type) for(let q = 0; q < this.difficulty[i]; q++) rooms.push(Shop)
      if(i === Miniboss.type) for(let q = 0; q < this.difficulty[i]; q++) rooms.push(Miniboss)
    }
    for (let i = 0; i < maxRooms; i++)
      this.preGenRooms.push(rooms[this.genNumber(0, rooms.length-1)])
  }

  public getIndex(str: Orientation): [number, number] {
    switch(str) {
      case 'N': return [0, 2]
      case 'E': return [1, 3]
      case 'S': return [2, 0]
      case 'W': return [3, 1]
    }
  }

  public getOrientation(ori: number): Orientation {
    switch (ori) {
      case 0: return 'N'
      case 1: return 'E'
      case 2: return 'S'
      case 3: return 'W'
      default: throw new Error()
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

  public getRoom(id: string): RoomSpec | null {
    for (const room of this.rooms) 
      if (room.id === id) return room
    return null
  }
}

class Base extends RoomSpec {
  public static override readonly type: RoomTypes = "base"
  public static override readonly maxSize: number = 15;
  public static override readonly minSize: number = 9;
  public static override readonly canConnectTo: RoomTypes[] = ["puzzle", "combat", "lore"]
  public override readonly type: RoomTypes = Base.type
  public override readonly maxSize: number = Base.maxSize
  public override readonly minSize: number = Base.minSize
  public override readonly canConnectTo: RoomTypes[] = Base.canConnectTo
  constructor(init: RoomInit) {
    super(init)
  }
}

class Puzzle extends RoomSpec {
  public static override readonly type: RoomTypes = "puzzle"
  public static override readonly maxSize: number = 27;
  public static override readonly minSize: number = 15;
  public static override readonly canConnectTo: RoomTypes[] = ["base", "boss", "miniboss", "combat", "lore", "shop", "bonus"]
  public override readonly type: RoomTypes = Puzzle.type
  public override readonly maxSize: number = Puzzle.maxSize
  public override readonly minSize: number = Puzzle.minSize
  public override readonly canConnectTo: RoomTypes[] = Puzzle.canConnectTo
  constructor(init: RoomInit) {
    super(init)
  }
}

class Boss extends RoomSpec {
  public static override readonly type: RoomTypes = "boss"
  public static override readonly maxSize: number = 35;
  public static override readonly minSize: number = 25;
  public static override readonly canConnectTo: RoomTypes[] = ["combat", "lore", "shop", "bonus"]
  public override readonly type: RoomTypes = Boss.type
  public override readonly maxSize: number = Boss.maxSize
  public override readonly minSize: number = Boss.minSize
  public override readonly canConnectTo: RoomTypes[] = Boss.canConnectTo
  constructor(init: RoomInit) {
    super(init)
  }
}

class Exit extends RoomSpec {
  public static override readonly type: RoomTypes = "exit"
  public static override readonly maxSize: number = 25;
  public static override readonly minSize: number = 15;
  public static override readonly canConnectTo: RoomTypes[] = ["combat", "lore", "shop"]
  public override readonly type: RoomTypes = Exit.type
  public override readonly maxSize: number = Exit.maxSize
  public override readonly minSize: number = Exit.minSize
  public override readonly canConnectTo: RoomTypes[] = Exit.canConnectTo
  constructor(init: RoomInit) {
    super(init)
  }
}

class Miniboss extends RoomSpec {
  public static override readonly type: RoomTypes = "miniboss"
  public static override readonly maxSize: number = 27;
  public static override readonly minSize: number = 23;
  public static override readonly canConnectTo: RoomTypes[] = ["combat", "lore", "shop", "bonus"]
  public override readonly type: RoomTypes = Miniboss.type
  public override readonly maxSize: number = Miniboss.maxSize
  public override readonly minSize: number = Miniboss.minSize
  public override readonly canConnectTo: RoomTypes[] = Miniboss.canConnectTo
  constructor(init: RoomInit) {
    super(init)
  }
}

class Combat extends RoomSpec {
  public static override readonly type: RoomTypes = "combat"
  public static override readonly maxSize: number = 23;
  public static override readonly minSize: number = 13;
  public static override readonly canConnectTo: RoomTypes[] = ["base", "boss", "miniboss", "combat", "combat", "lore", "shop", "bonus"]
  public override readonly type: RoomTypes = Combat.type
  public override readonly maxSize: number = Combat.maxSize
  public override readonly minSize: number = Combat.minSize
  public override readonly canConnectTo: RoomTypes[] = Combat.canConnectTo
  constructor(init: RoomInit) {
    super(init)
  }
}

class Lore extends RoomSpec {
  public static override readonly type: RoomTypes = "lore"
  public static override readonly maxSize: number = 13;
  public static override readonly minSize: number = 9;
  public static override readonly canConnectTo: RoomTypes[] = ["base", "boss", "miniboss", "combat", "combat", "bonus"]
  public override readonly type: RoomTypes = Lore.type
  public override readonly maxSize: number = Lore.maxSize
  public override readonly minSize: number = Lore.minSize
  public override readonly canConnectTo: RoomTypes[] = Lore.canConnectTo
  constructor(init: RoomInit) {
    super(init)
  }
}

class Shop extends RoomSpec {
  public static override readonly type: RoomTypes = "shop"
  public static override readonly maxSize: number = 17;
  public static override readonly minSize: number = 13;
  public static override readonly canConnectTo: RoomTypes[] = ["base", "boss", "miniboss", "combat", "combat", "bonus"]
  public override readonly type: RoomTypes = Shop.type
  public override readonly maxSize: number = Shop.maxSize
  public override readonly minSize: number = Shop.minSize
  public override readonly canConnectTo: RoomTypes[] = Shop.canConnectTo
  constructor(init: RoomInit) {
    super(init)
  }
}

class Bonus extends RoomSpec {
  public static override readonly type: RoomTypes = "bonus"
  public static override readonly maxSize: number = 17;
  public static override readonly minSize: number = 9;
  public static override readonly canConnectTo: RoomTypes[] = ["boss"]
  public override readonly type: RoomTypes = Bonus.type
  public override readonly maxSize: number = Bonus.maxSize
  public override readonly minSize: number = Bonus.minSize
  public override readonly canConnectTo: RoomTypes[] = Bonus.canConnectTo
  constructor(init: RoomInit) {
    super(init)
  }
}

const Level1 = new Level({
  hasBoss: false,
  difficulty: 0,
  level: 1,
  seed: 'hello.'
})

console.log(Level1.rooms)
console.log(Level1)

// homiranha nunca bate só apanha! <3 
// Pedro Thiago, eu te amooo!!!
// Quis fugir de mim mesmo, mas onde eu ia, eu tava
// coração: meu amigo se vc não parar, eu paro
// Reage mulher! Bota um cropped. Vamos galera, mulheres! 