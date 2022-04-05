import './style.css'
import * as THREE from 'three'
import * as dat from 'dat.gui'
import * as CANNON from 'cannon-es'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

// Debug
const gui = new dat.GUI()

// animate variables 
const objectsToUpdate = []
const clock = new THREE.Clock()

// three.js variables 
let canvas
const wheelVisuals = []
let camera, scene, renderer, controls
let plane, planeGeometry, planeMaterial
let carGeometry, carMaterial, box
let wheelGeometry, wheelMaterial3, cylinder

// cannon.js variables 
let world
let boxbody, boxShape
let boxSize = 1.3
let boxCount = 5
let boxs, boxGeometry, boxMaterial
let oldElapsedTime = 0
let wheelBodies = []
let groundMaterial, wheelMaterial, wheelGroundContactMaterial
let chassisShape, chassisBody
let floorShape, floorBody
let vehicle, options
let shape, body, q

initThree()
initCannon()
animate()

// position cubes 
for (let x = boxSize; x < boxSize * boxCount + 0.3; x += boxSize + 0.06) {
    for (let y = boxSize - 0.1; y < boxSize * boxCount + 0.3; y += boxSize + 0.08) {
        createBox(x, y)
    }
}

// three.js here
function initThree() {

    // Canvas
    canvas = document.querySelector('canvas.webgl')

    // Sizes
    const sizes = {
        width: window.innerWidth,
        height: window.innerHeight
    }

    // Scene
    scene = new THREE.Scene()

    // Base camera
    camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000)
    camera.position.x = 0.08
    camera.position.y = 10.23
    camera.position.z = 20
    camera.lookAt(scene.position)
    scene.add(camera)

    // Controls
    controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.target.set(0, 0.5, 0)

    // // Draco loader
    // const dracoLoader = new DRACOLoader()
    // dracoLoader.setDecoderPath('draco/')

    // // GLTF loader
    // const gltfLoader = new GLTFLoader()
    // gltfLoader.setDRACOLoader(dracoLoader)

    /* All additonal code goes here */

    // multiple box
    boxGeometry = new THREE.BoxBufferGeometry(boxSize, boxSize, boxSize)
    boxMaterial = new THREE.MeshStandardMaterial()

    // plane geometry 
    planeGeometry = new THREE.PlaneGeometry(60, 60, 2)
    planeMaterial = new THREE.MeshStandardMaterial({ color: 'blue', side: THREE.DoubleSide })
    plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.rotation.x = - Math.PI / 2
    scene.add(plane)

    // // problem here 
    // let box
    // gltfLoader.load(
    //     'car.glb',
    //     function models(gltf) {
    //         box = gltf.scene
    //         box.scale.set(2, 2, 2)
    //         scene.add(box)
    //     }
    // )
    // console.log(box); // i need value of box here

    // car visual body
    carGeometry = new THREE.BoxGeometry(2, 0.6, 4)
    carMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, side: THREE.DoubleSide })
    box = new THREE.Mesh(carGeometry, carMaterial)
    scene.add(box)

    /* Additional code ends here */

    // Handling resize event 
    window.addEventListener('resize', () => {
        // Update sizes
        sizes.width = window.innerWidth
        sizes.height = window.innerHeight

        // Update camera
        camera.aspect = sizes.width / sizes.height
        camera.updateProjectionMatrix()

        // Update renderer
        renderer.setSize(sizes.width, sizes.height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    })

    // Ambient light
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.5)
    scene.add(ambientLight)

    // Directional light
    const moonLight = new THREE.DirectionalLight('#ffffff', 0.9)
    moonLight.position.set(0, 20, 10)
    gui.add(moonLight, 'intensity').min(0).max(1).step(0.001).name('Lights Intensity')
    scene.add(moonLight)

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas
    })
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

// Physics here
function initCannon() {

    // initalize physics world 
    world = new CANNON.World()
    world.broadphase = new CANNON.SAPBroadphase(world)
    world.gravity.set(0, -9.8, 0)
    gui.add(world.gravity, 'y').min(-20).max(20).step(1).name('Gravity')
    world.defaultContactMaterial.friction = 4

    // physics material 
    groundMaterial = new CANNON.Material('groundMaterial')
    wheelMaterial = new CANNON.Material('wheelMaterial')

    // contact b/w two material
    wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
        friction: 0.3,
        restitution: 0,
        contactEquationStiffness: 1000,
    })
    gui.add(wheelGroundContactMaterial, 'friction').min(-10).max(10).step(1).name('Ground Friction')
    gui.add(wheelGroundContactMaterial, 'restitution').min(-10).max(10).step(1).name('restitution')
    world.addContactMaterial(wheelGroundContactMaterial)

    // car physics body
    chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.3, 2))
    chassisBody = new CANNON.Body({ mass: 200 })
    chassisBody.addShape(chassisShape)
    chassisBody.position.set(0, 0.2, 5.5)
    chassisBody.angularVelocity.set(0, 0, 0)

    // body is part of vechile now
    vehicle = new CANNON.RaycastVehicle({
        chassisBody: chassisBody,
        indexRightAxis: 0, // x
        indexUpAxis: 1, // y
        indexForwardAxis: 2, // z
    })

    // car options 
    options = {
        radius: 0.3,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        suspensionStiffness: 45,
        suspensionRestLength: 0.4,
        frictionSlip: 4,
        dampingRelaxation: 2.3,
        dampingCompression: 4.5,
        maxSuspensionForce: 200000,
        rollInfluence: 0.01,
        axleLocal: new CANNON.Vec3(-1, 0, 0),
        chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
        maxSuspensionTravel: 0.25,
        customSlidingRotationalSpeed: -30,
        useCustomSlidingRotationalSpeed: true,
    }

    const axlewidth = 0.7

    options.chassisConnectionPointLocal.set(axlewidth, 0, -1)
    vehicle.addWheel(options)

    options.chassisConnectionPointLocal.set(-axlewidth, 0, -1)
    vehicle.addWheel(options)

    options.chassisConnectionPointLocal.set(axlewidth, 0, 1)
    vehicle.addWheel(options)

    options.chassisConnectionPointLocal.set(-axlewidth, 0, 1)
    vehicle.addWheel(options)

    vehicle.addToWorld(world)

    boxShape = new CANNON.Box(new CANNON.Vec3(boxSize * 0.5, boxSize * 0.5, boxSize * 0.5))

    // floor physics 
    floorShape = new CANNON.Box(new CANNON.Vec3(60 * 0.5, 60 * 0.5, 0.1))
    floorBody = new CANNON.Body()
    floorBody.material = groundMaterial
    floorBody.mass = 0
    floorBody.addShape(floorShape)
    floorBody.quaternion.setFromAxisAngle(
        new CANNON.Vec3(1, 0, 0),
        - Math.PI * 0.5
    )
    world.addBody(floorBody)
}

function createBox(x, y) {

    // three.js mesh
    boxs = new THREE.Mesh(boxGeometry, boxMaterial)
    boxs.position.set(x, y, 0)
    scene.add(boxs)

    // cannon.js mesh 
    boxbody = new CANNON.Body({
        mass: 0.5,
        //change postion here
        position: new CANNON.Vec3(x, y, -2),
        shape: boxShape,
        material: wheelMaterial
    })

    world.addBody(boxbody)

    // Save in objects
    objectsToUpdate.push({ boxs, boxbody })

}

// car wheels
vehicle.wheelInfos.forEach(function (wheel) {

    // wheel physics body
    shape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20)
    body = new CANNON.Body({ mass: 1, material: wheelMaterial })
    q = new CANNON.Quaternion()
    q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2)
    body.addShape(shape, new CANNON.Vec3(), q);
    wheelBodies.push(body)

    // wheel visual body
    wheelGeometry = new THREE.CylinderGeometry(wheel.radius, wheel.radius, 0.4, 32)
    wheelMaterial3 = new THREE.MeshPhongMaterial({
        color: 0xd0901d,
        emissive: 0xaa0000,
        side: THREE.DoubleSide,
        flatShading: true,
    })
    cylinder = new THREE.Mesh(wheelGeometry, wheelMaterial3)
    cylinder.geometry.rotateZ(Math.PI / 2)
    wheelVisuals.push(cylinder)
    scene.add(cylinder)

})

// update the wheels to match the physics
world.addEventListener('postStep', function () {
    for (var i = 0; i < vehicle.wheelInfos.length; i++) {
        vehicle.updateWheelTransform(i)
        var t = vehicle.wheelInfos[i].worldTransform

        // update wheel physics
        wheelBodies[i].position.copy(t.position)
        wheelBodies[i].quaternion.copy(t.quaternion)

        // update wheel visuals
        wheelVisuals[i].position.copy(t.position)
        wheelVisuals[i].quaternion.copy(t.quaternion)
    }
})

// Animation here
function animate() {
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - oldElapsedTime
    oldElapsedTime = elapsedTime

    // update physics world 
    world.step(1 / 60, deltaTime, 3)
    // console.log(box.position);
    box.position.copy(chassisBody.position)
    box.quaternion.copy(chassisBody.quaternion)

    if (vehicle.chassisBody.position.y < -5.5) {
        vehicle.chassisBody.position.copy(new THREE.Vector3(0, 0.2, 5.5))
        confirm("Game Over, Restart?")
        window.location.reload()
    }
    // camera
    for (const object of objectsToUpdate) {
        object.boxs.position.copy(object.boxbody.position)
        object.boxs.quaternion.copy(object.boxbody.quaternion)
    }

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(animate)
}

// key controls 
function navigate(e) {
    if (e.type != 'keydown' && e.type != 'keyup') return;
    var keyup = e.type == 'keyup';
    vehicle.setBrake(0, 0);
    vehicle.setBrake(0, 1);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);

    var engineForce = 800,
        maxSteerVal = 0.3;
    switch (e.keyCode) {

        case 38: // forward
        case 87:
            vehicle.applyEngineForce(keyup ? 0 : engineForce, 2);
            vehicle.applyEngineForce(keyup ? 0 : engineForce, 3);
            break;

        case 40: // backward
        case 83:
            vehicle.applyEngineForce(keyup ? 0 : -engineForce, 2);
            vehicle.applyEngineForce(keyup ? 0 : -engineForce, 3);
            break;

        case 39: // right
        case 68:
            vehicle.setSteeringValue(keyup ? 0 : maxSteerVal, 2);
            vehicle.setSteeringValue(keyup ? 0 : maxSteerVal, 3);
            break;

        case 37: // left
        case 65:
            vehicle.setSteeringValue(keyup ? 0 : -maxSteerVal, 2);
            vehicle.setSteeringValue(keyup ? 0 : -maxSteerVal, 3);
            break;
        default:
        // console.log(vehicle.chassisBody.position);

    }
}

window.addEventListener('keydown', navigate)
window.addEventListener('keyup', navigate)