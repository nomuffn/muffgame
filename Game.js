import Matter from 'matter-js'
import MatterTools from 'matter-tools'

const {
    Engine,
    Render,
    Runner,
    Composites,
    Common,
    MouseConstraint,
    Mouse,
    Composite,
    Bodies,
    Events,
    World,
    Body,
    Query,
    Vector,
} = Matter

const scoreText = document.getElementById('game-score')

class Game {
    score = 0

    toAnimate = {} // balls that need to be animated; key is id of object

    defaultCategory = 0x0001
    mouseCategory = 0x0002

    sizes = [
        { size: 25, score: 1 },
        { size: 35, score: 2 },
        { size: 50, score: 4 },
        { size: 60, score: 8 },
        { size: 80, score: 16 },
        { size: 100, score: 32 },
        { size: 125, score: 64 },
        { size: 150, score: 128 },
    ]

    getNextSize(size) {
        const sizeIndex = this.sizes.findIndex((item) => item.size == size)
        console.log('getNextSize', size)
        console.log('sizeIndex', sizeIndex)
        if (sizeIndex < 0 || sizeIndex + 1 >= this.sizes.length) return this.sizes[0].size

        return this.sizes[sizeIndex + 1].size
    }

    wall(x, y, width, height) {
        return Bodies.rectangle(x, y, width, height, {
            isStatic: true,
            render: {
                fillStyle: '#868e96',
            },
            collisionFilter: {
                mask: this.defaultCategory,
            },
        })
    }

    // matter.js has a built in random range function, but it is deterministic
    rand(min, max) {
        return Math.random() * (max - min) + min
    }

    spawnBall(x, y, size = this.sizes[0].size, isStatic = false) {
        const sizeIndex = this.sizes.findIndex((item) => item.size == size)
        size = this.sizes[sizeIndex].size

        const ball = Bodies.circle(x, y, size, {
            restitution: 0.5,
            label: 'ball',
            isStatic,
            render: {
                // fillStyle: '#e64980',
                sprite: {
                    texture: `./assets/muff${sizeIndex}.png`,
                    xScale: size / 250,
                    yScale: size / 250,
                },
            },
            /*
                If the two bodies have the same non-zero value of collisionFilter.group, they will always collide if the value is positive, and they will never collide if the value is negative.
                Using the category/mask rules, two bodies A and B collide if each includes the other's category in its mask, i.e. (categoryA & maskB) !== 0 and (categoryB & maskA) !== 0 are both true.
            */
            // collisionFilter: {
            //     category: this.mouseCategory,
            // },
        })

        Body.setVelocity(ball, {
            x: 0, // this.rand(-0.5, 0.5),
            y: 0,
        })
        // Matter.Body.setAngularVelocity(ball, this.rand(-0.05, 0.05))

        World.add(this.engine.world, ball)
        return ball
    }

    dropBall() {
        if (this.currentBall) {
            World.remove(this.engine.world, this.currentBall)
            this.spawnBall(this.currentBall.position.x, 50, this.currentBall.circleRadius)
            this.currentBall = null
        }
    }

    addScore(radius) {
        const score = this.sizes.find((item) => item.size == radius).score
        this.score += score
        scoreText.innerText = this.score
    }

    constructor() {
        // engine
        this.engine = Engine.create()

        // render
        let render = Render.create({
            element: document.body,
            engine: this.engine,
            options: {
                width: 560,
                height: 800,
                wireframes: false,
                background: '#212121',
            },
        })
        Render.run(render)

        // runner
        let runner = Runner.create()
        Runner.run(runner, this.engine)

        // mouse constraint
        let mouseConstraint = MouseConstraint.create(this.engine, {
            mouse: Mouse.create(render.canvas),
            collisionFilter: {
                mask: this.mouseCategory,
            },
        })
        World.add(this.engine.world, mouseConstraint)

        Events.on(mouseConstraint, 'mousedown', (event) => {
            // Handle the mouse click event here
            console.log('Mouse clicked!', event)
            const mousePosition = event.mouse.mousedownPosition

            const bodiesAtMouse = Query.point(Composite.allBodies(this.engine.world), mousePosition)

            if (this.currentBall) {
                this.dropBall()
            } else if (bodiesAtMouse.length == 0) {
                // too slow with: if (mouseConstraint.body === null) {
                // random index in this.sizes
                const randomIndex = Math.floor((Math.random() * this.sizes.length) / 2)
                this.currentBall = this.spawnBall(
                    event.mouse.position.x,
                    50,
                    this.sizes[randomIndex].size,
                    true,
                )
            }
        })
        Events.on(mouseConstraint, 'mousemove', (event) => {
            console.log(render.options)
            if (
                this.currentBall &&
                event.mouse.position.x > 100 &&
                event.mouse.position.x < render.options.width - 100
            ) {
                this.currentBall.position.x = event.mouse.position.x
            }
        })

        Events.on(mouseConstraint, 'mouseup', (event) => {
            this.dropBall()
        })

        Events.on(this.engine, 'collisionStart', (e) => {
            for (let i = 0; i < e.pairs.length; i++) {
                const { bodyA, bodyB } = e.pairs[i]

                if (bodyA.isStatic || bodyB.isStatic) continue
                if (bodyA.label != 'ball' || bodyB.label != 'ball') continue

                if (bodyA.circleRadius == bodyB.circleRadius) {
                    if (!(bodyA.id in this.toAnimate))
                        this.toAnimate[bodyA.id] = {
                            body: bodyA,
                            smaller: true,
                            towards: bodyB,
                            radius: bodyA.circleRadius,
                        }

                    if (!(bodyB.id in this.toAnimate))
                        this.toAnimate[bodyB.id] = {
                            body: bodyB,
                            smaller: true,
                            towards: bodyA,
                            radius: bodyB.circleRadius,
                        }

                    console.log(this.toAnimate)
                }
            }
        })

        var lastTime = 0,
            scaleRate = 5,
            radiusLimit = 10

        Events.on(this.engine, 'beforeUpdate', (event) => {
            // var timeScale = (event.delta || 1000 / 60) / 1000
            var timeScale = event.delta / 10000

            for (const key in this.toAnimate) {
                const animate = this.toAnimate[key]
                if (!animate) continue

                const ball = animate.body
                const towards = animate.towards

                console.log(animate)
                if (ball.circleRadius < radiusLimit) {
                    const midpointX = (ball.position.x + towards.position.x) / 2
                    const midpointY = (ball.position.y + towards.position.y) / 2

                    console.log('spawn & remove', ball)
                    this.addScore(animate.radius)
                    this.spawnBall(midpointX, midpointY, this.getNextSize(animate.radius))

                    World.remove(this.engine.world, ball)
                    World.remove(this.engine.world, towards)
                    delete this.toAnimate[key]
                    delete this.toAnimate[towards.id]
                } else if (animate.smaller && ball.circleRadius >= radiusLimit) {
                    const scale = 0.95 + scaleRate * timeScale * -1
                    Body.scale(ball, scale, scale)
                    ball.render.sprite.xScale = ball.render.sprite.xScale * scale
                    ball.render.sprite.yScale = ball.render.sprite.yScale * scale

                    Body.setVelocity(ball, {
                        x: (towards.position.x - ball.position.x) / 10,
                        y: (towards.position.y - ball.position.y) / 10,
                    })
                }
            }

            // if (this.engine.timing.timestamp - lastTime >= 1500) {
            //     scaleRate = 0
            // }

            // if (scaleRate > 0) {
            //     Body.scale(bodyF, 1 + scaleRate * timeScale, 1 + scaleRate * timeScale)
            //     // modify bodyE vertices
            //     bodyE.vertices[0].x -= 0.2 * timeScale
            //     bodyE.vertices[0].y -= 0.2 * timeScale
            //     bodyE.vertices[1].x += 0.2 * timeScale
            //     bodyE.vertices[1].y -= 0.2 * timeScale
            //     Body.setVertices(bodyE, bodyE.vertices)
            // }
            // // make bodyA move up and down
            // var py = 300 + 100 * Math.sin(engine.timing.timestamp * 0.002)
            // // manual update velocity required for older releases
            // if (Matter.version === '0.18.0') {
            //     Body.setVelocity(bodyA, { x: 0, y: py - bodyA.position.y })
            //     Body.setVelocity(compound, { x: 0, y: py - compound.position.y })
            //     Body.setAngularVelocity(compound, 1 * Math.PI * timeScale)
            // }
            // // move body and update velocity
            // Body.setPosition(bodyA, { x: 100, y: py }, true)
            // // after first 0.8 sec (simulation time)
            // if (engine.timing.timestamp >= 800) Body.setStatic(bodyG, true)
            // // every 1.5 sec (simulation time)
            // if (engine.timing.timestamp - lastTime >= 1500) {
            //     Body.setVelocity(bodyB, { x: 0, y: -10 })
            //     Body.setAngle(bodyC, -Math.PI * 0.26)
            //     Body.setAngularVelocity(bodyD, 0.2)
            //     // stop scaling
            //     scaleRate = 0
            //     // update last time
            //     lastTime = engine.timing.timestamp
            // }
        })

        const test = this.spawnBall(200, 25)
        test.collisionFilter.category = this.defaultCategory

        // boundary walls
        World.add(this.engine.world, [
            this.wall(280, 0, 560, 20), // top
            this.wall(280, 800, 560, 20), // bottom
            this.wall(0, 400, 20, 800), // left
            this.wall(560, 400, 20, 800), // right
        ])

        // divider walls
        // World.add(this.engine.world, this.wall(100, 610, 20, 600))
        // World.add(this.engine.world, this.wall(460, 610, 20, 600))

        // for Matter Tools
        const matterTools = () => {
            return {
                engine: this.engine,
                render: render,
                canvas: render.canvas,
                runner: runner,

                stop: () => {
                    Render.stop(render)
                    Runner.stop(runner)
                },
            }
        }

        // for Matter Tools
        // this code is simplified for a single example and leaves out otherwise required props
        // to see how setting up multiple examples works, check out /demos/lightning-round/my.js
        // MatterTools.Demo.create({
        //     appendTo: document.body,
        //     tools: {
        //         gui: true,
        //     },
        //     examples: [
        //         {
        //             id: 'galton-board',
        //             init: matterTools,
        //         },
        //     ],
        // })
    }
}
export default new Game()
