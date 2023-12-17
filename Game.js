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
const globals = {
    width: 500,
    height: 800,
}

class Game {
    score = 0

    toAnimate = {} // balls that need to be animated; key is id of object
    deathTimes = {}

    defaultCategory = 0x0001
    mouseCategory = 0x0002

    width = globals.width
    height = globals.height
    leftLimit = 10 // half of wall width
    rightLimit = this.width - 10
    lastX = this.width / 2

    sizes = [
        { size: 25, score: 10 },
        { size: 35, score: 20 },
        { size: 50, score: 40 },
        { size: 60, score: 80 },
        { size: 80, score: 160 },
        { size: 100, score: 320 },
        { size: 125, score: 640 },
        { size: 150, score: 1280 },
    ]

    getNextSize(size) {
        const sizeIndex = this.sizes.findIndex((item) => item.size == size)
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

    spawnBall(size = this.sizes[0].size, isStatic = false, xPos = this.lastX, yPos = 75) {
        const sizeIndex = this.sizes.findIndex((item) => item.size == size)
        size = this.sizes[sizeIndex].size

        xPos = this.getValidXPos(xPos)

        const inertia = 1
        const ball = Bodies.circle(xPos, yPos, size, {
            restitution: 0.5,
            label: 'ball',
            size,
            isStatic,
            density: 1000,
            // inertia: inertia,
            // inverseInertia: 1 / inertia,
            friction: 1,
            frictionStatic: 0,
            restitution: 0.3,
            slop: 0.2,
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
            collisionFilter: {
                category: this.defaultCategory,
            },
        })

        Body.setVelocity(ball, {
            x: 0, // this.rand(-0.5, 0.5),
            y: 0,
        })
        // Matter.Body.setAngularVelocity(ball, this.rand(-0.05, 0.05))

        World.add(this.engine.world, ball)
        return ball
    }

    // add small timeout
    dropBall() {
        if (
            Composite.allBodies(this.engine.world).filter((item) => item.label == 'ball').length ==
            0
        ) {
            this.score = 0
            scoreText.innerText = this.score
        }

        if (this.currentBall) {
            World.remove(this.engine.world, this.currentBall)
            const ball = this.spawnBall(this.currentBall.circleRadius)
            this.currentBall = null
        }
        if (!this.currentBall) {
            // delay next spawn
            setTimeout(() => {
                const randomIndex = Math.floor((Math.random() * this.sizes.length) / 3)

                const size = this.sizes[randomIndex].size

                this.currentBall = this.spawnBall(size, true)
            }, 250)
        }
    }

    addScore(ballSize) {
        const score = this.sizes.find((item) => item.size == ballSize).score

        this.score += score
        scoreText.innerText = this.score
    }
    endGame() {
        scoreText.innerText = this.score + ' Loser'
        for (const ball of Composite.allBodies(this.engine.world).filter(
            (item) => item.label == 'ball',
        )) {
            console.log('remove', ball)
            World.remove(this.engine.world, ball)
            this.toAnimate = {}
        }
        World.remove(this.engine.world, this.currentBall)
        this.currentBall = null
        setTimeout(() => {
            this.dropBall()
        }, 4000)
    }

    getValidXPos(xPos) {
        // account for barries and ball size
        const circleRadius = this.currentBall?.circleRadius || 0
        xPos = Math.max(xPos, this.leftLimit + circleRadius)
        xPos = Math.min(xPos, this.rightLimit - circleRadius)
        return xPos
        if (
            xPos > this.leftLimit + this.currentBall.circleRadius &&
            xPos < this.rightLimit - this.currentBall.circleRadius
        ) {
            return xPos
        }
    }

    constructor() {
        // engine
        this.engine = Engine.create()

        // render
        let render = Render.create({
            element: document.body,
            engine: this.engine,
            isFixed: true,
            options: {
                width: globals.width,
                height: globals.height,
                wireframes: false,
                background: '#212121',
            },
        })
        this.render = render
        Render.run(render)

        // runner
        let runner = Runner.create()
        Runner.run(runner, this.engine)

        // this.engine.gravity.scale = 0.0015

        // mouse constraint
        let mouseConstraint = MouseConstraint.create(this.engine, {
            mouse: Mouse.create(render.canvas),
            collisionFilter: {
                mask: this.mouseCategory,
            },
        })
        World.add(this.engine.world, mouseConstraint)

        Events.on(mouseConstraint, 'mouseup', (event) => {
            const mousePosition = event.mouse.mouseupPosition
            const bodiesAtMouse = Query.point(Composite.allBodies(this.engine.world), mousePosition)

            this.lastX = this.getValidXPos(mousePosition.x)

            if (this.currentBall) {
                this.dropBall()
            } else if (bodiesAtMouse.length == 0) {
                // too slow with: if (mouseConstraint.body === null) {
                // random index in this.sizes
            }
        })
        Events.on(mouseConstraint, 'mousemove', (event) => {
            const xPos = this.getValidXPos(event.mouse.position.x)
            if (this.currentBall) {
                this.currentBall.position.x = xPos
            }
            this.lastX = xPos
        })

        this.dropBall()

        Events.on(this.engine, 'collisionStart', (e) => {
            for (let i = 0; i < e.pairs.length; i++) {
                const { bodyA, bodyB } = e.pairs[i]

                if (bodyA.isStatic || bodyB.isStatic) continue
                if (bodyA.label != 'ball' || bodyB.label != 'ball') continue

                if (bodyA.circleRadius == bodyB.circleRadius) {
                    var constraint = Matter.Constraint.create({
                        bodyA: bodyA,
                        pointA: { x: 0, y: 0 }, // Offset from objectA's position
                        bodyB: bodyB,
                        pointB: { x: 0, y: 0 }, // Offset from objectB's position
                        length: 0, // Set the length to 0 to make them stick together
                        render: { visible: false },
                    })
                    World.add(this.engine.world, constraint)

                    bodyA.constraint = constraint
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
                }
            }
        })

        Events.on(this.engine, 'collisionActive', (e) => {
            for (let i = 0; i < e.pairs.length; i++) {
                const { bodyA, bodyB } = e.pairs[i]

                const ball = bodyA.label == 'ball' ? bodyA : bodyB.label == 'ball' ? bodyB : null
                const death = bodyA.label == 'death' || bodyB.label == 'death'

                if (death && ball) {
                    if (ball.id in this.deathTimes) this.deathTimes[ball.id]++
                    else this.deathTimes[ball.id] = 0

                    if (this.deathTimes[ball.id] >= 500) this.endGame()
                }
            }
        })

        var scaleRate = 5,
            radiusLimit = 10

        Events.on(this.engine, 'beforeUpdate', (event) => {
            // var timeScale = (event.delta || 1000 / 60) / 1000
            var timeScale = event.delta / 10000

            for (const key in this.toAnimate) {
                const animate = this.toAnimate[key]
                if (!animate) continue

                const ball = animate.body
                const towards = animate.towards

                if (ball.circleRadius < radiusLimit) {
                    const midpointX = (ball.position.x + towards.position.x) / 2
                    const midpointY = (ball.position.y + towards.position.y) / 2

                    this.addScore(animate.radius)
                    this.spawnBall(this.getNextSize(animate.radius), false, midpointX, midpointY)

                    const constraint = ball.constraint || towards.constraint

                    World.remove(this.engine.world, constraint)
                    World.remove(this.engine.world, ball)
                    World.remove(this.engine.world, towards)
                    delete this.toAnimate[key]
                    delete this.toAnimate[towards.id]
                } else if (animate.smaller && ball.circleRadius >= radiusLimit) {
                    const scale = 0.94 + scaleRate * timeScale * -1
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

        // const test = this.spawnBall(200, 25)
        // test.collisionFilter.category = this.defaultCategory

        // boundary walls
        World.add(this.engine.world, [
            this.wall(this.width / 2, 0, this.width, 20), // top
            this.wall(this.width / 2, globals.height, this.width, 20), // bottom
            this.wall(0, globals.height / 2, 20, globals.height), // left
            this.wall(this.width, 400, 20, globals.height), // right

            Bodies.rectangle(this.width / 2, 150, this.width - 20, 5, {
                isStatic: true,
                isSensor: true,
                label: 'death',
                render: {
                    fillStyle: '#FF0000',
                },
                collisionFilter: {
                    category: -1,
                    mask: -1,
                },
            }),
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
