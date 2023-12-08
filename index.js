import Game from './Game'

if (module.hot) {
    module.hot.accept()
}

const resizeCanvas = () => {
    const screenWidth = document.body.clientWidth
    const screenHeight = document.body.clientHeight

    let gameWidth = Game.width
    let gameHeight = Game.height

    if (screenWidth * 1.5 > screenHeight) {
        gameHeight = Math.min(Game.height, screenHeight)
        gameWidth = gameHeight / 1.5
    } else {
        gameWidth = Math.min(Game.width, screenWidth)
        gameHeight = gameWidth * 1.5
    }

    Game.render.canvas.style.width = `${gameWidth}px`
    Game.render.canvas.style.height = `${gameHeight}px`
}

document.body.onload = resizeCanvas
document.body.onresize = resizeCanvas
