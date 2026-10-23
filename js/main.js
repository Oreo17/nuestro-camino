import * as THREE from 'three';
import gsap from 'gsap';

// =======================================================
// PREMIOS SORPRESA ALEATORIOS
// =======================================================
const premiosJSON = [
    { "titulo": "Tarde de Lego y Café", "descripcion": "Construir juntos un set de Lego mientras tomamos algo rico y platicamos." },
    { "titulo": "Maratón y Alitas", "descripcion": "Una tarde relajada comiendo alitas deliciosas y viendo un maratón de la serie que elijamos juntos." },
    { "titulo": "Noche de Cine y Helado", "descripcion": "Una salida al cine a ver lo que queramos, terminando la cita con tu helado favorito." },
    { "titulo": "Cena Especial y Tragos", "descripcion": "Una velada bonita, con buena comida, unos tragos coquetos y muchas risas juntos." },
    { "titulo": "Cita de Pizza Gourmet", "descripcion": "Una cena especial disfrutando de una pizza deliciosa, platicando sin prisas y pasando el rato." }
];

// =======================================================
// CONFIGURACIÓN GLOBAL
// =======================================================
let estadoJuego = 'INTRO'; 
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const rendererIntro = new THREE.WebGLRenderer({ antialias: true, alpha: true });
rendererIntro.setPixelRatio(window.devicePixelRatio);
rendererIntro.setSize(window.innerWidth, window.innerHeight);
document.getElementById('intro-canvas').appendChild(rendererIntro.domElement);

const mensaje = document.getElementById('mensaje');
const subtitulo = document.getElementById('subtitulo');
const btnIniciar = document.getElementById('btn-iniciar');
const btnAlinear = document.getElementById('btn-alinear');
const btnSiguiente = document.getElementById('btn-siguiente');
const btnFinal = document.getElementById('btn-final');

// =======================================================
// ESCENA 1: INTRODUCCIÓN (EL CAOS)
// =======================================================
const introScene = new THREE.Scene();
const introCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10);
introCamera.position.z = 2;
let introMesh;

function crearIntroCaos() {
    const vector = new THREE.Vector4();
    const instances = 50000;
    const positions = [], offsets = [], colors = [], orientationsStart = [], orientationsEnd = [];
    positions.push(0.025, -0.025, 0); positions.push(-0.025, 0.025, 0); positions.push(0, 0, 0.025);

    for (let i = 0; i < instances; i++) {
        offsets.push(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        colors.push(Math.random(), Math.random(), Math.random(), Math.random());
        vector.set(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1, Math.random()*2-1).normalize();
        orientationsStart.push(vector.x, vector.y, vector.z, vector.w);
        vector.set(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1, Math.random()*2-1).normalize();
        orientationsEnd.push(vector.x, vector.y, vector.z, vector.w);
    }
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.instanceCount = instances;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3));
    geometry.setAttribute('color', new THREE.InstancedBufferAttribute(new Float32Array(colors), 4));
    geometry.setAttribute('orientationStart', new THREE.InstancedBufferAttribute(new Float32Array(orientationsStart), 4));
    geometry.setAttribute('orientationEnd', new THREE.InstancedBufferAttribute(new Float32Array(orientationsEnd), 4));

    const material = new THREE.RawShaderMaterial({
        uniforms: { 'time': { value: 1.0 }, 'sineTime': { value: 1.0 } },
        vertexShader: `
            precision highp float; uniform float sineTime; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
            attribute vec3 position; attribute vec3 offset; attribute vec4 color; attribute vec4 orientationStart; attribute vec4 orientationEnd;
            varying vec3 vPosition; varying vec4 vColor;
            void main(){
                vPosition = offset * max( abs( sineTime * 2.0 + 1.0 ), 0.5 ) + position;
                vec4 orientation = normalize( mix( orientationStart, orientationEnd, sineTime ) );
                vec3 vcV = cross( orientation.xyz, vPosition );
                vPosition = vcV * ( 2.0 * orientation.w ) + ( cross( orientation.xyz, vcV ) * 2.0 + vPosition );
                vColor = color; gl_Position = projectionMatrix * modelViewMatrix * vec4( vPosition, 1.0 );
            }
        `,
        fragmentShader: `
            precision highp float; uniform float time; varying vec3 vPosition; varying vec4 vColor;
            void main() { vec4 color = vec4( vColor ); color.r += sin( vPosition.x * 10.0 + time ) * 0.5; gl_FragColor = color; }
        `,
        side: THREE.DoubleSide, transparent: true
    });
    introMesh = new THREE.Mesh(geometry, material);
    introScene.add(introMesh);
}
crearIntroCaos();

// =======================================================
// ESCENA 2: EL JUEGO 
// =======================================================
const scene = new THREE.Scene();
const aspect = window.innerWidth / window.innerHeight;
const d = 10;
const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
camera.position.set(20, 15, 20); camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight('#ffffff', 0.5));
const dirLight = new THREE.DirectionalLight('#ffffff', 0.8);
dirLight.position.set(10, 20, 10); dirLight.castShadow = true;
dirLight.shadow.camera.left = -15; dirLight.shadow.camera.right = 15;
dirLight.shadow.camera.top = 15; dirLight.shadow.camera.bottom = -15;
scene.add(dirLight);

const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
let interaccionActiva = false; let bloquesCamino = []; let personaje; 

const materialBase = new THREE.MeshStandardMaterial({ color: '#e5d9c5' }); 
const materialAcento = new THREE.MeshStandardMaterial({ color: '#b5838d' }); 
const materialFlor = new THREE.MeshStandardMaterial({ color: '#ffb5a7' }); 

const mundoLvl1 = new THREE.Group(); 
mundoLvl1.position.y = -2; // Altura centrada y separada del texto

function crearBloqueEstatico(x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    mundoLvl1.add(mesh);
}

function construirIniciales() {
    // Letra A 
    crearBloqueEstatico(-4, 4, 0, materialFlor); 
    crearBloqueEstatico(-6, 2, 0, materialBase); crearBloqueEstatico(-2, 2, 0, materialBase); 
    crearBloqueEstatico(-6, 0, 0, materialAcento); crearBloqueEstatico(-4, 0, 0, materialAcento); crearBloqueEstatico(-2, 0, 0, materialAcento); 
    crearBloqueEstatico(-6, -2, 0, materialBase); crearBloqueEstatico(-2, -2, 0, materialBase); 
    
    // Letra O 
    crearBloqueEstatico(2, 4, 0, materialFlor); crearBloqueEstatico(4, 4, 0, materialFlor); crearBloqueEstatico(6, 4, 0, materialFlor); 
    crearBloqueEstatico(2, 2, 0, materialBase); crearBloqueEstatico(6, 2, 0, materialBase); 
    crearBloqueEstatico(2, 0, 0, materialBase); crearBloqueEstatico(6, 0, 0, materialBase); 
    crearBloqueEstatico(2, -2, 0, materialFlor); crearBloqueEstatico(4, -2, 0, materialFlor); crearBloqueEstatico(6, -2, 0, materialFlor); 
}

// =======================================================
// TRANSICIONES Y NARRATIVA
// =======================================================
btnIniciar.addEventListener('click', () => {
    btnIniciar.style.display = 'none';
    
    const audioFondo = document.getElementById('musica-fondo');
    if (audioFondo) {
        audioFondo.volume = 0.5;
        audioFondo.play().catch(e => console.log("Música requiere interacción previa."));
    }
    
    gsap.to(rendererIntro.domElement, { opacity: 0, duration: 2, onComplete: () => {
        estadoJuego = 'TRANSICION';
        document.getElementById('intro-canvas').style.display = 'none';
        
        mensaje.innerText = "Amor mío...";
        subtitulo.innerText = "Lo que hemos construido juntos es hermoso. Nos admiramos, nos respetamos y queremos hacer las cosas bien.";
        gsap.to([mensaje, subtitulo], { opacity: 1, duration: 2 });

        setTimeout(() => {
            gsap.to([mensaje, subtitulo], { opacity: 0, duration: 1.5, onComplete: () => {
                
                construirIniciales();
                mundoLvl1.rotation.set(Math.PI / 3, Math.PI / 1.5, Math.PI / 4);
                scene.add(mundoLvl1);
                estadoJuego = 'JUEGO';

                mensaje.innerText = "Un comienzo increíble";
                subtitulo.innerText = "Sé que eres alguien que se esfuerza y siempre busca ser mejor. Me encanta la idea de acompañarnos.";
                gsap.to([mensaje, subtitulo], { opacity: 1, duration: 1.5 });
                
                btnAlinear.style.display = 'inline-block';
                gsap.fromTo(btnAlinear, { opacity: 0 }, { opacity: 1, duration: 1.5 });
            }});
        }, 5500);
    }});
});

btnAlinear.addEventListener('click', () => {
    gsap.to(btnAlinear, { opacity: 0, duration: 0.5, onComplete: () => btnAlinear.style.display = 'none' });
    gsap.to(mundoLvl1.rotation, { x: 0, y: Math.PI / 4, z: 0, duration: 3, ease: "power3.inOut" });
    gsap.to(camera.position, { x: 20, y: 15, z: 20, duration: 3, ease: "power3.inOut",
        onComplete: () => {
            gsap.to([mensaje, subtitulo], { opacity: 0, duration: 0.5, onComplete: () => {
                mensaje.innerText = "Crecer juntos";
                subtitulo.innerText = "Quiero que nos sigamos conociendo, construyendo y mejorando a lo largo del camino.";
                gsap.to([mensaje, subtitulo], { opacity: 1, duration: 1 });
                
                btnSiguiente.style.display = 'inline-block';
                gsap.fromTo(btnSiguiente, { opacity: 0 }, { opacity: 1, duration: 1 });
            }});
        }
    });
});

btnSiguiente.addEventListener('click', () => {
    gsap.to([mensaje, subtitulo, btnSiguiente], { opacity: 0, duration: 1, onComplete: () => btnSiguiente.style.display = 'none' });
    gsap.to(mundoLvl1.position, { y: -30, duration: 2.5, ease: "power2.in" });
    setTimeout(() => { scene.remove(mundoLvl1); iniciarNivel2(); }, 2500);
});

// GATITO (Gris con ojos verdes y nariz rosa)
function crearGatito(colorCuerpo = '#85929E', colorOrejas = '#E6B0AA') {
    const gatito = new THREE.Group();
    const matGato = new THREE.MeshStandardMaterial({ color: colorCuerpo }); 
    const matOrejas = new THREE.MeshStandardMaterial({ color: colorOrejas });
    const matOjos = new THREE.MeshStandardMaterial({ color: '#A9DFBF' }); 
    const matNariz = new THREE.MeshStandardMaterial({ color: '#F1948A' }); 
    
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.2), matGato); 
    cuerpo.position.set(0, 0.3, 0); cuerpo.castShadow = true; gatito.add(cuerpo);
    
    const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), matGato); 
    cabeza.position.set(0, 0.7, 0.5); cabeza.castShadow = true; gatito.add(cabeza);
    
    const orejaGeo = new THREE.ConeGeometry(0.15, 0.3, 4);
    const orejaDer = new THREE.Mesh(orejaGeo, matOrejas); 
    orejaDer.position.set(0.2, 1.1, 0.5); orejaDer.rotation.y = Math.PI/4; orejaDer.castShadow = true; gatito.add(orejaDer);
    const orejaIzq = new THREE.Mesh(orejaGeo, matOrejas); 
    orejaIzq.position.set(-0.2, 1.1, 0.5); orejaIzq.rotation.y = Math.PI/4; orejaIzq.castShadow = true; gatito.add(orejaIzq);
    
    const ojoGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const ojoDer = new THREE.Mesh(ojoGeo, matOjos);
    ojoDer.position.set(0.15, 0.8, 0.81); gatito.add(ojoDer);
    const ojoIzq = new THREE.Mesh(ojoGeo, matOjos);
    ojoIzq.position.set(-0.15, 0.8, 0.81); gatito.add(ojoIzq);

    const nariz = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), matNariz);
    nariz.position.set(0, 0.65, 0.81); gatito.add(nariz);

    const cola = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), matGato);
    cola.position.set(0, 0.6, -0.6); cola.rotation.x = -Math.PI/6; gatito.add(cola);
    
    return gatito;
}

function crearBloqueJugable(x, y, z, esMeta = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), esMeta ? materialFlor : materialBase);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    bloquesCamino.push(mesh); scene.add(mesh);
    mesh.position.y = y - 20; gsap.to(mesh.position, { y: y, duration: 1.5 + Math.random(), ease: "back.out(1.5)" });
    return mesh;
}

function iniciarNivel2() {
    mensaje.innerText = "Cuidarnos y respetarnos";
    subtitulo.innerText = "Quiero brindarte mi cariño, cuidarte y que disfrutemos juntos cada paso que demos.\n(Haz clic en los bloques para avanzar)";
    gsap.to([mensaje, subtitulo], { opacity: 1, duration: 1 }); 

    crearBloqueJugable(-2, -4, -2); crearBloqueJugable(0, -4, -2); crearBloqueJugable(2, -4, -2);
    crearBloqueJugable(2, -4, 0); crearBloqueJugable(2, -4, 2, true); 

    personaje = crearGatito(); 
    personaje.position.set(-2, -20, -2); scene.add(personaje);
    
    // Animación de entrada del gatito
    gsap.to(personaje.position, { y: -3, duration: 2, ease: "power2.out", delay: 1 });
    crearParticulas(); 
    
    // Bloqueamos interacciones hasta que el nivel esté armado
    setTimeout(() => { interaccionActiva = true; }, 2000);
}

// =======================================================
// NIVEL 3: CAMINO ESTÁTICO (SIN BUGS DE FÍSICAS)
// =======================================================
function iniciarNivel3() {
    mensaje.innerText = "Lo que viene";
    subtitulo.innerText = "A veces habrá retos, pero me emociona saber que nos tenemos el uno al otro, junto a Aguacate y Guacamole.";
    gsap.to([mensaje, subtitulo], { opacity: 1, duration: 1 });

    crearBloqueJugable(-4, -4, 0); 
    crearBloqueJugable(-2, -4, 0);
    crearBloqueJugable(0, -4, 0);
    crearBloqueJugable(0, -4, -2);
    crearBloqueJugable(2, -4, -2);
    crearBloqueJugable(2, -4, -4);
    crearBloqueJugable(4, -4, -4, true); 

    personaje = crearGatito(); 
    personaje.position.set(-4, -20, 0); scene.add(personaje);
    
    gsap.to(personaje.position, { y: -3, duration: 2, ease: "power2.out", delay: 1 });
    
    // Bloqueamos interacciones hasta que el nivel esté armado
    setTimeout(() => { interaccionActiva = true; }, 2500);
}

// LÓGICA DE MOVIMIENTO INFALIBLE
window.addEventListener('pointerdown', (event) => {
    if (!interaccionActiva) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1; mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(bloquesCamino);

    if (intersects.length > 0) {
        const bloqueDestino = intersects[0].object;

        const distX = Math.abs(Math.round(bloqueDestino.position.x) - Math.round(personaje.position.x));
        const distZ = Math.abs(Math.round(bloqueDestino.position.z) - Math.round(personaje.position.z));
        
        if ((distX === 2 && distZ === 0) || (distX === 0 && distZ === 2)) {
            interaccionActiva = false;
            
            gsap.to(personaje.position, { 
                x: bloqueDestino.position.x, 
                z: bloqueDestino.position.z, 
                duration: 0.4, 
                ease: "power1.inOut",
                onComplete: () => {
                    if (bloqueDestino.material !== materialFlor) interaccionActiva = true;
                }
            });
            
            // Animación de salto en arco
            const catY = personaje.position.y;
            gsap.to(personaje.position, { y: catY + 0.8, duration: 0.2, yoyo: true, repeat: 1 });
            
            if (bloqueDestino.material === materialFlor) {
                setTimeout(() => {
                    gsap.to([mensaje, subtitulo], { opacity: 0, duration: 0.5, onComplete: () => {
                        
                        if (bloquesCamino.length === 5) { // Era el Nivel 2
                            bloquesCamino.forEach(b => gsap.to(b.position, { y: -30, duration: 2, ease: "power2.in", delay: Math.random() * 0.5 }));
                            gsap.to(personaje.position, { y: -30, duration: 2, ease: "power2.in" });
                            
                            setTimeout(() => {
                                bloquesCamino.forEach(b => scene.remove(b)); scene.remove(personaje); bloquesCamino = [];
                                iniciarNivel3();
                            }, 2500);

                        } else { // Era el Nivel 3
                            mensaje.innerText = "Nuestra historia";
                            subtitulo.innerText = "Cada paso a tu lado es una nueva aventura que me hace ilusión descubrir.";
                            btnFinal.style.display = 'inline-block';
                            gsap.fromTo(btnFinal, { opacity: 0 }, { opacity: 1, duration: 1 });
                            gsap.to([mensaje, subtitulo], { opacity: 1, duration: 1 });
                        }
                    }});
                }, 500);
            }
        }
    }
});

// =======================================================
// EL GRAN FINAL
// =======================================================
btnFinal.addEventListener('click', () => {
    gsap.to([mensaje, subtitulo, btnFinal], { opacity: 0, duration: 1, onComplete: () => btnFinal.style.display = 'none' });
    
    bloquesCamino.forEach(b => gsap.to(b.position, { y: -30, duration: 2, ease: "power2.in", delay: Math.random() * 0.5 }));
    gsap.to(personaje.position, { y: -30, duration: 2, ease: "power2.in" });

    setTimeout(() => {
        bloquesCamino.forEach(b => scene.remove(b)); scene.remove(personaje); 
        iniciarGranFinal();
    }, 2500);
});

function iniciarGranFinal() {
    mensaje.innerText = "Disfrutar el camino.";
    subtitulo.innerText = "Me haces inmensamente feliz. Gracias por ser mi novia y por esta hermosa oportunidad de caminar a tu lado.";
    
    gsap.to([mensaje, subtitulo], { opacity: 1, duration: 2, delay: 2 });
    gsap.to(camera.position, { x: 15, y: 10, z: 15, duration: 4, ease: "power3.inOut" });

    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), materialFlor);
    pedestal.position.set(0, -20, 0); pedestal.castShadow = true; pedestal.receiveShadow = true;
    scene.add(pedestal); gsap.to(pedestal.position, { y: -4, duration: 2.5, ease: "back.out(1.2)" });

    const gato1 = crearGatito('#85929E', '#E6B0AA'); // Gatito Gris
    gato1.position.set(-0.8, -20, 0); gato1.rotation.y = Math.PI / 2; scene.add(gato1);
    gsap.to(gato1.position, { y: -2.5, duration: 2.5, ease: "power2.out", delay: 0.5 });

    const gato2 = crearGatito('#e5d9c5', '#d4c7a5'); // Gatito Crema
    gato2.position.set(0.8, -20, 0); gato2.rotation.y = -Math.PI / 2; scene.add(gato2);
    gsap.to(gato2.position, { y: -2.5, duration: 2.5, ease: "power2.out", delay: 1 });

    setTimeout(() => {
        gsap.to([mensaje, subtitulo], { opacity: 0, duration: 1.5 });

        // Recalcular cámara del intro por si hubo zoom
        introCamera.aspect = window.innerWidth / window.innerHeight; 
        introCamera.updateProjectionMatrix();
        rendererIntro.setSize(window.innerWidth, window.innerHeight);

        estadoJuego = 'MIXTO'; 
        document.getElementById('intro-canvas').style.display = 'block';
        
        gsap.to(rendererIntro.domElement, { opacity: 1, duration: 2 });
        gsap.to(renderer.domElement, { opacity: 0, duration: 2, onComplete: () => {
            estadoJuego = 'INTRO';
            
            setTimeout(() => {
                const premioAleatorio = premiosJSON[Math.floor(Math.random() * premiosJSON.length)];
                document.getElementById('premio-titulo').innerText = premioAleatorio.titulo;
                document.getElementById('premio-desc').innerText = premioAleatorio.descripcion;
                document.getElementById('modal-premio').classList.remove('oculto');
            }, 8000); 
            
        }});
    }, 10000); 
}

document.getElementById('btn-cerrar-premio').addEventListener('click', () => {
    document.getElementById('modal-premio').classList.add('oculto');
});

function crearParticulas() {
    const geo = new THREE.BufferGeometry(); const vertices = [];
    for (let i = 0; i < 700; i++) vertices.push((Math.random()-0.5)*40, (Math.random()-0.5)*40, (Math.random()-0.5)*40);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.15, color: '#e5d9c5', transparent: true, opacity: 0.4 })));
}

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    
    if (estadoJuego === 'INTRO' || estadoJuego === 'MIXTO') {
        const time = performance.now();
        introMesh.rotation.y = time * 0.0005; 
        introMesh.material.uniforms['time'].value = time * 0.005;
        introMesh.material.uniforms['sineTime'].value = Math.sin(introMesh.material.uniforms['time'].value * 0.05);
        rendererIntro.render(introScene, introCamera);
    } 
    
    if (estadoJuego === 'JUEGO' || estadoJuego === 'TRANSICION' || estadoJuego === 'MIXTO') {
        const tiempo = clock.getElapsedTime();
        scene.children.forEach(c => { 
            if (c instanceof THREE.Points) c.rotation.y = tiempo * 0.05; 
        });
        renderer.render(scene, camera);
    }
}
animate();

window.addEventListener('resize', () => {
    if (estadoJuego === 'INTRO' || estadoJuego === 'MIXTO') {
        introCamera.aspect = window.innerWidth / window.innerHeight; introCamera.updateProjectionMatrix();
        rendererIntro.setSize(window.innerWidth, window.innerHeight);
    }
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -d * aspect; camera.right = d * aspect; camera.top = d; camera.bottom = -d;
    camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});