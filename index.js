const $ = require('jquery')
const jimp = require('jimp')
const dataUriToBuffer = require('data-uri-to-buffer')
require('floodfill')
const ndarray = require('ndarray')
const tumult = require('tumult')
const THREE = require('three')

const Water = require('three/examples/jsm/objects/Water')
const Sky = require('three/examples/jsm/objects/Sky')
const OrbitControls = require('three/examples/jsm/controls/OrbitControls')

class Terrain {
    constructor(width = 512, plateau_height = 10, terrain_height = 40, depth = 512, noise_scale = 0.01, iso = 0.2, container = $('body')) {
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

        // Absolute height of the terrain
        this.absolute_height = plateau_height + terrain_height

        this.ui = $('<div id="cropper" class="active"><img id="display"/></div><btn id="cropconfirm" class="active">Crop</btn><canvas id="heightmap">').appendTo(this.container)
    }

    init_rendering(terrain) {
        this.sun_parameters = {
            distance: 400,
            inclination: 0.49,
            azimuth: 0.205
        }

        // Skybox
        this.sky = new Sky()

        this.sky_uniforms = sky.material.uniforms

        this.sky_uniforms['turbidity'].value = 10
        this.sky_uniforms['rayleigh'].value = 2
        this.sky_uniforms['luminance'].value = 1
        this.sky_uniforms['mieCoefficient'].value = 0.005
        this.sky_uniforms['mieDirectionalG'].value = 0.8

        this.cube_render_target = new THREE.WebGLCubeRenderTarget(512, {
            format: THREE.RGBFormat,
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter
        })

        this.cube_camera = new THREE.CubeCamera(0.1, 1, cubeRenderTarget)

        this.scene = new THREE.Scene()
        this.scene.background = cube_render_target

        this.light = new THREE.DirectionalLight(0xffffff, 0.5)
        this.light.position.set(5.0, 10.0, 7.5)
        this.light.lookAt(0, 0, 0)
        this.scene.add(this.light)

        this.geometry_water = new THREE.PlaneBufferGeometry(this.width, this.depth)

        this.water = new Water(
            this.geometry_water, {
                textureWidth: 256,
                textureHeight: 256,
                waterNormals: new THREE.TextureLoader().load('textures/waternormals.jpg', function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
                    texture.repeat = 8
                }),
                alpha: 1.0,
                sunDirection: this.light.position.clone().normalize(),
                sunColor: 0xffffff,
                waterColor: 0x001e0f,
                distortionScale: 3.7,
                fog: this.scene.fog !== undefined
            }
        )

        this.group_terrain = new THREE.Group()
        this.group_terrain.position.set(0.0, 0.0, 0.0)

        this.material_terrain = new THREE.MeshPhongMaterial({
            color: 0x88ff88,
            reflectivity: 0.1,
            flatShading: false
        })

        this.mesh_terrain = new THREE.Mesh(this.terrain, this.material_terrain)
        this.mesh_terrain.position.x = ((-this.width * this.terrain_scale) / 2.0)
        this.mesh_terrain.position.y = -(this.plateau_height / 2.0)
        this.mesh_terrain.position.z = ((-this.depth * this.terrain_scale) / 2.0)

        this.water.rotation.x = -Math.PI / 2

        this.group_terrain.add(this,mesh_terrain)

        this.scene.add(this.group_terrain)
        this.scene.add(this.water)

        this.renderer = new THREE.WebGLRenderer({
            antialias: true
        })

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 10000)
        this.camera.position.set(0, this.terrain_height * 3, this.depth)
        this.camera.lookAt(0, 0, 0)

        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.controls.maxPolarAngle = Math.PI * 0.495
        this.controls.target.set(0, 0, 0)
        this.controls.minDistance = 40.0
        this.controls.maxDistance = 200.0
        this.controls.update()

        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.container.append(renderer.domElement)
    }

    update_sun() {
        let theta = Math.PI * (this.sun_parameters.inclination - 0.5)
        let phi = 2 * Math.PI * (this.sun_parameters.azimuth - 0.5)

        this.light.position.x = this.sun_parameters.distance * Math.cos(phi);
        this.light.position.y = this.sun_parameters.distance * Math.sin(phi) * Math.sin(theta)
        this.light.position.z = this.sun_parameters.distance * Math.sin(phi) * Math.cos(theta)

        this.sky.material.uniforms['sunPosition'].value = this.light.position.copy(this.light.position)
        this.water.material.uniforms['sunDirection'].value.copy(this.light.position).normalize()

        this.cube_camera.update(this.renderer, this.sky)
    }

    animate() {
        requestAnimationFrame(animate)

        water.material.uniforms['time'].value += 1.0 / 60.0;

        renderer.render(scene, camera)
    }

    render(terrain) {
        init_rendering(terrain)
        update_sun()
        animate()
    }

    image_to_heightmap(path = this.path) {
        return new Promise((resolve, reject) => {
            $('#display').attr('src', path)
            let crop_x, crop_y, crop_w, crop_h

            const cropper = new Cropper($('#display')[0], {
                viewMode: 3,
                scalable: false,
                zoomable: false,
                crop(event) {
                    // Update crop coords
                    crop_x = event.detail.x
                    crop_y = event.detail.y
                    crop_h = event.detail.height
                    crop_w = event.detail.width
                }
            })

            $('#cropconfirm').on('click', e => {
                $('#cropconfirm').off('click').removeClass('active')
                $('#cropper').removeClass('active')

                // Load img
                jimp.read('public/' + path).then(image => {

                    let _d = image.getWidth() > image.getHeight() ? image.getWidth : image.getHeight()

                    // Crop with given coords
                    image.crop(Math.round(crop_x), Math.round(crop_y), Math.round(crop_w), Math.round(crop_h))
                        .resize(this.resolution, this.resolution)
                        .threshold({
                            max: 170
                        }).invert()
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

                    image.getBuffer(jimp.AUTO, (e, src) => {
                        let img_cropped = new Image()

                        let _s = src.reduce((data, byte) => {
                            return data + String.fromCharCode(byte)
                        }, '')
                        let _b64 = btoa(_s)

                        img_cropped.src = 'data:image/png;base64,' + _b64

                        img_cropped.onload = e => {
                            // Width and height of image
                            let w = image.getWidth()
                            let h = image.getHeight()

                            $('#heightmap').attr({
                                width: w,
                                height: h
                            })

                            let canvas = $('#heightmap')
                            let ctx = $('#heightmap')[0].getContext('2d')
                            $('#heightmap').addClass('active')

                            // redraw
                            ctx.clearRect(0, 0, w, h)
                            ctx.drawImage(img_cropped, 0, 0)

                            // Filling Shapes
                            ctx.fillStyle = '#000000'
                            ctx.fillFlood(0, 0, 8)

                            // Erosion
                            jimp.read(dataUriToBuffer(canvas[0].toDataURL())).then((img_filled) => {
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

                                w = img_filled.getWidth()
                                h = img_filled.getHeight()

                                $('canvas').attr({
                                    'width': w,
                                    'height': h
                                })

                                img_filled.getBuffer(jimp.AUTO, (e, img_eroded) => {
                                    let _img_eroded = new Image()

                                    let _s = img_eroded.reduce((data, byte) => {
                                        return data + String.fromCharCode(byte)
                                    }, '')
                                    let _b64 = btoa(_s)

                                    _img_eroded.src = 'data:image/png;base64,' + _b64

                                    _img_eroded.onload = e => {
                                        // Redraw
                                        ctx.clearRect(0, 0, w, h)
                                        ctx.drawImage(_img_eroded, 0, 0)

                                        let heightmap = ndarray(new Int8Array(w * h), [w, h])

                                        for (let x = 0; x < w; x++) {
                                            for (let y = 0; y < h; y++) {
                                                heightmap[x, y] = Math.round(ctx.getImageData(x, y, 1, 1).data[0] / 255.0)
                                            }
                                        }

                                        resolve(heightmap)
                                    }
                                })
                            })
                        }
                    })
                })
            })
        })
    }

    heightmap_to_densitymap(heightmap = this.heightmap) {
        return new Promise((resolve, reject) => {
            const w = heightmap.length
            const h = heightmap[0].length

            // Convert 2d heightmap from canvas to 3d voxel grid
            let densitymap = ndarray(new Float32Array(w * (terrain_height + 1) * h), [w, terrain_height + 1, h])
            let noise = new tumult.Perlin3()

            for (let x = 0; x < w; x++) {
                for (let y = 0; y < absolute_height + 1; y++) {
                    for (let z = 0; z < h; z++) {
                        if (y < plateau_height) {
                            // Generate plateau
                            densitymap.set(x, y, z, ctx.getImageData(x, z, 1, 1).data[0] / 255.0)
                        } else if (y >= plateau_height) {
                            // mask perlin noise to generate surface terrain
                            let mask = heightmap[x][z] == 255 ? 1.0 : 0.0

                            let noise_val = noise.octavate(4, x * noise_scale * sample_frequency, y * noise_scale * sample_frequency, z * noise_scale * sample_frequency)
                            let height_multiplier = 1.0 - ((y - plateau_height) / terrain_height)
                            let density = mask * (noise_val + (height_multiplier * 2.0 - 1.0))

                            density = Math.min(Math.max(density, 0.0), 1.0)
                            densitymap.set(x, y, z, density)
                        } else {
                            // Add empty layer on top
                            densitymap.set(x, y, z, 0.0)
                        }
                    }
                }
            }

            resolve(densitymap, resolution)
        })
    }

    densitymap_to_geometry(densitymap = this.densitymap) {
        return new Promise((resolve, reject) => {
            let geometry = new THREE.Geometry()
            let __mesh

            for (let data of isosurface(density_map, iso)) {
                __mesh = data
            }

            for (let vertice of __mesh.positions) {
                geometry.vertices.push(new THREE.Vector3(vertice[0] * terrain_scale, vertice[1] * terrain_scale, vertice[2] * terrain_scale))
            }
            for (let cell of __mesh.cells) {
                geometry.faces.push(new THREE.Face3(cell[0], cell[1], cell[2]))
            }

            geometry.computeFaceNormals()
            geometry.computeVertexNormals(true)

            resolve(geometry)
        })
    }

    from_image(path) {
        return new Promise((resolve, reject) => {
            this.image_to_heightmap(path).then(heightmap => {
                this.heightmap = heightmap
                resolve(this.heightmap)
            }).then(heightmap => heightmap_to_densitymap).then(densitymap => {
                this.densitymap = densitymap
                resolve(this.densitymap)
            }).then(densitymap => densitymap_to_terrain).then(terrain => {
                this.terrain = terrain
                resolve(this.terrain)
            })
        })
    }

    from_heightmap(heightmap) {
        return new Promise((resolve, reject) => {
            this.heightmap_to_densitymap(heightmap).then(densitymap => {
                this.densitymap = densitymap
                resolve(this.densitymap)
            }).then(densitymap => densitymap_to_terrain).then(terrain => {
                this.terrain = terrain
                resolve(this.terrain)
            })
        })
    }

    from_densitymap(densitymap) {
        return new Promise((resolve, reject) => {
            this.densitymap_to_terrain(densitymap).then(terrain => {
                this.terrain = terrain
                resolve(this.terrain)
            })
        })
    }

}

module.exports.Terrain = Terrain