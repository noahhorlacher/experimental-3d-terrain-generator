const jimp = require('jimp')
const dataUriToBuffer = require('data-uri-to-buffer')
require('floodfill')
const ndarray = require('ndarray')
const tumult = require('tumult')
const THREE = require('three')
const isosurface = require('isosurface-generator')

class Terrain {
    constructor(width = 512, plateau_height = 10, terrain_height = 40, depth = 512, noise_scale = 0.01, iso = 0.2, display_element = null) {
        // Width of the terrain
        this.width = width
        // Height of the plateau
        this.plateau_height = plateau_height
        // Height of the terrain on top of the plateau
        this.terrain_height = terrain_height
        // Depth of the terrain
        this.depth = depth
        // Scale of the perlin noise
        this.noise_scale = noise_scale
        // Threshold for when something is matter and when not
        this.iso = iso

        // A canvas element for displaying the steps
        this.display_element = display_element

        // Show the display element
        if (this.display_element) {
            this.display_element.classList.add('active')
            this.display_element.setAttribute('width', this.width * 3)
            this.display_element.setAttribute('height', this.depth)
        }

        // Absolute height of the terrain
        this.absolute_height = plateau_height + terrain_height
    }

    image_to_heightmap(path = null, buffer = null) {
        return new Promise((resolve) => {
            // Load the image either from buffer or a path
            let __img = buffer ? buffer : path

            jimp.read(__img, async (e, image) => {
                // Resize the image to the given dimensions
                image.resize(this.width, this.depth)
                    // Make it black and white and push contrast
                    .threshold({
                        max: 170
                    }).invert()
                    // Dilate the lines
                    .convolute([
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
                    ]).invert()

                // Draw it to a canvas to extract the shapes
                image.getBuffer(jimp.AUTO, (e, src) => {
                    let img_dilated = new Image()
                    let _s = src.reduce((data, byte) => {
                        return data + String.fromCharCode(byte)
                    }, '')
                    let _b64 = btoa(_s)
                    img_dilated.src = 'data:image/png;base64,' + _b64

                    img_dilated.onload = e => {
                        let canvas = document.createElement("canvas")
                        let ctx = canvas.getContext('2d')

                        canvas.setAttribute('width', this.width)
                        canvas.setAttribute('height', this.depth)

                        // Draw the processed image
                        if (this.display_element) this.display_element.ctx.drawImage(img_dilated, this.width, 0)
                        ctx.drawImage(img_dilated, 0, 0)

                        console.log("img dilated", img_dilated)

                        // Fill the shapes
                        ctx.fillStyle = '#000000'
                        ctx.fillFlood(0, 0, 8)

                        jimp.read(dataUriToBuffer(canvas.toDataURL()), (e, img_filled) => {
                            // Erosion
                            img_filled
                                .invert()
                                .convolute([
                                    [1, 1, 1],
                                    [1, 1, 1],
                                    [1, 1, 1]
                                ])
                                .convolute([
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
                                ]).invert()

                            img_filled.getBuffer(jimp.AUTO, (e, src) => {
                                let img_eroded = new Image()
                                let _s = src.reduce((data, byte) => {
                                    return data + String.fromCharCode(byte)
                                }, '')
                                let _b64 = btoa(_s)
                                img_eroded.src = 'data:image/png;base64,' + _b64

                                img_eroded.onload = e => {
                                    // Redraw
                                    ctx.clearRect(0, 0, this.width, this.depth)
                                    ctx.drawImage(img_eroded, 0, 0)

                                    if (this.display_element) this.display_element.ctx.drawImage(img_eroded, this.width * 2, 0)

                                    this.heightmap = ndarray(new Int8Array(this.width * this.depth), [this.width, this.depth])

                                    for (let x = 0; x < this.width; x++) {
                                        for (let y = 0; y < this.depth; y++) {
                                            this.heightmap[x, y] = Math.round(ctx.getImageData(x, y, 1, 1).data[0] / 255.0)
                                        }
                                    }

                                    resolve(this.heightmap)
                                }
                            })
                        })
                    }
                })
            })
        })
    }

    heightmap_to_densitymap(heightmap = this.heightmap) {
        return new Promise(resolve => {
            // Convert 2d heightmap from canvas to 3d voxel grid
            this.densitymap = ndarray(new Float32Array(this.width * (this.absolute_height + 1) * this.depth), [this.width, this.absolute_height + 1, this.depth])
            let noise = new tumult.Perlin3()

            for (let x = 0; x < this.width; x++) {
                for (let y = 0; y < this.absolute_height + 1; y++) {
                    for (let z = 0; z < this.depth; z++) {
                        if (y < this.plateau_height) {
                            // Generate plateau
                            this.densitymap.set(x, y, z, this.heightmap[x, z])
                        } else if (y >= this.plateau_height) {
                            // mask perlin noise to generate surface terrain
                            let mask = this.heightmap[x][z]

                            let noise_val = noise.octavate(4, x * this.noise_scale, y * this.noise_scale, z * this.noise_scale)
                            let height_multiplier = 1.0 - ((y - this.plateau_height) / this.terrain_height)
                            let density = mask * (noise_val + (height_multiplier * 2.0 - 1.0))

                            density = Math.min(Math.max(density, 0.0), 1.0)
                            this.densitymap.set(x, y, z, density)
                        } else {
                            // Add empty layer on top
                            this.densitymap.set(x, y, z, 0.0)
                        }
                    }
                }
            }

            resolve(this.densitymap)
        })
    }

    densitymap_to_geometry(densitymap = this.densitymap) {
        return new Promise(resolve => {
            let __mesh
            this.geometry = {
                vertices: [],
                faces: []
            }

            for (let data of isosurface(densitymap, this.iso)) {
                __mesh = data
            }

            for (let vertex of __mesh.positions) {
                this.geometry.vertices.push([vertex[0], vertex[1], vertex[2]])
            }
            for (let cell of __mesh.cells) {
                this.geometry.faces.push([cell[0], cell[1], cell[2]])
            }

            resolve(this.geometry)
        })
    }

    to_threejs(geometry = this.geometry) {
        let threejs_geometry = new THREE.Geometry()

        for (let vertex of geometry.vertices) {
            threejs_geometry.vertices.push(new THREE.Vector3(vertex[0], vertex[1], vertex[2]))
        }
        for (let face of geometry.faces) {
            threejs_geometry.faces.push(new THREE.Face3(face[0], face[1], face[2]))
        }

        threejs_geometry.computeFaceNormals()
        threejs_geometry.computeVertexNormals(true)

        return threejs_geometry
    }

    from_image = async function (path = null, buffer = null) {
        return new Promise(async (resolve) => {
            let __img = buffer ? buffer : path

            console.log('image buffer or path', __img)
            this.heightmap = await this.image_to_heightmap(path)
            console.log('heightmap', this.heightmap)
            this.densitymap = await this.heightmap_to_densitymap(this.heightmap)
            console.log('densitymap', this.densitymap)
            this.geometry = await this.densitymap_to_geometry(this.densitymap)
            console.log('geometry', this.geometry)

            resolve(this.geometry)
        })
    }

    from_heightmap(heightmap) {
        this.heightmap = heightmap

        this.densitymap = this.heightmap_to_densitymap(heightmap)
        this.geometry = this.densitymap_to_geometry(this.densitymap)

        return this.geometry
    }

    from_densitymap(densitymap) {
        this.densitymap = densitymap

        this.geometry = this.densitymap_to_geometry(densitymap)

        return this.geometry
    }

}

module.exports.Terrain = Terrain