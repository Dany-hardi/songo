# Jeu Songo — TP INF222

Implémentation du jeu de semailles traditionnel Songo, réalisée dans le cadre du travail pratique de l'unité d'enseignement **INF222 — Programmation Web** (EC2), Département d'Informatique, Université de Yaoundé I.

**Étudiant :** Ngankeu Takou Daniel Wilfried   
**Niveau :** Licence 2 Informatique  
**Année académique :** 2025–2026

---

## À propos du jeu

Le Songo est un jeu de semailles traditionnel originellement pratiqué par les peuples Ekang du Cameroun (Ewondo, Bulu, Béti, Eton). Il se joue à deux joueurs sur un tablier de deux rangées de 7 cases, chacune contenant 5 graines au départ (70 graines au total). Le premier joueur à récolter 40 graines remporte la partie.

Les règles complètes sont accessibles directement dans l'interface du jeu via le panneau **Règles du jeu**.

---

## Structure du projet

```
songo-inf222/
├── v1/                     Version locale (deux joueurs, même machine)
│   ├── index.html          Page principale
│   ├── songo.js            Logique complète du jeu (classe SongoGame)
│   ├── ui.js               Rendu et interactions (classe SongoUI)
│   └── style.css           Feuille de style
│
└── v2/                     Version réseau (deux joueurs, machines distantes)
    ├── index.html          Page principale + lobby de connexion
    ├── songo-logic.js      Logique complète du jeu (module SongoLogic)
    ├── app.js              Couche réseau Ajax + rendu
    ├── style.css           Feuille de style
    ├── game_state.json     État partagé de la partie (écrit par PHP)
    ├── state.php           Endpoint GET — retourne l'état courant
    ├── move.php            Endpoint POST — enregistre un coup
    ├── join.php            Endpoint POST — un joueur rejoint la partie
    ├── new_game.php        Endpoint POST — réinitialise la partie
    └── reset.php           Endpoint POST — arrêt synchronisé des deux clients
```

---

## Technologies utilisées

| Composant | Technologie |
|---|---|
| Interface | HTML5, CSS3, JavaScript (ES5/ES6) |
| Communication réseau | Ajax — XMLHttpRequest natif (sans bibliothèque) |
| Backend | PHP 8.x |
| Persistance | Fichier JSON côté serveur |
| Serveur local | Apache (XAMPP) |

Aucune bibliothèque externe (jQuery, Axios, React, etc.) n'est utilisée dans ce projet. Tout est écrit en JavaScript et PHP natifs.

---

## Version 1 — Deux joueurs, même machine

Cette version fonctionne entièrement dans le navigateur. Tout l'état de la partie vit en mémoire JavaScript. Les deux joueurs se partagent l'ordinateur et se passent la souris à chaque tour. Aucun serveur PHP n'est nécessaire, mais il faut quand même Apache pour servir les fichiers via `http://` (le protocole `file://` pose des restrictions dans les navigateurs modernes).

### Lancer la version 1

```bash
# Démarrer XAMPP
sudo /opt/lampp/lampp start

# Copier les fichiers
sudo mkdir -p /opt/lampp/htdocs/songo/v1
sudo cp v1/* /opt/lampp/htdocs/songo/v1/
```

Ouvrir dans le navigateur : [http://localhost/songo/v1/](http://localhost/songo/v1/)

---

## Version 2 — Deux joueurs, machines distantes (Ajax)

Cette version utilise une architecture client-serveur. La logique du jeu est calculée côté client en JavaScript. Le serveur PHP se contente de lire et d'écrire un fichier JSON (`game_state.json`) qui sert d'état partagé entre les deux navigateurs. La synchronisation entre les deux machines est assurée par un mécanisme de **polling Ajax** toutes les 1,5 secondes : chaque client interroge régulièrement le serveur pour savoir si l'adversaire a joué.

### Lancer la version 2

```bash
# Démarrer XAMPP
sudo /opt/lampp/lampp start

# Copier les fichiers
sudo mkdir -p /opt/lampp/htdocs/songo/v2
sudo cp v2/* /opt/lampp/htdocs/songo/v2/

# Donner les droits d'écriture sur le fichier d'état
sudo chmod 666 /opt/lampp/htdocs/songo/v2/game_state.json
```

### Faire jouer deux machines ensemble

- **Machine qui héberge le serveur :** ouvrir [http://localhost/songo/v2/](http://localhost/songo/v2/) et choisir un camp (SUD ou NORD).
- **Machine distante (même réseau Wi-Fi) :** ouvrir `http://[IP-du-serveur]/songo/v2/` et choisir l'autre camp.

Pour trouver l'adresse IP du serveur :
```bash
hostname -I
```

Pour tester sur une seule machine, ouvrir la même URL dans deux navigateurs différents (Firefox + Chrome par exemple).

### Réinitialiser entre deux parties

Le bouton rouge **ARRÊTER** visible dans l'en-tête réinitialise la partie et libère les deux camps de façon synchronisée sur les deux navigateurs, sans manipulation du terminal.

---

## Fonctionnement technique de la communication réseau

Quand le joueur SUD joue un coup :

1. `app.js` envoie un `GET` vers `state.php` pour récupérer l'état le plus récent.
2. `SongoLogic.play()` calcule localement la distribution des graines, les récoltes et les vérifications de règles.
3. `app.js` envoie un `POST` vers `move.php` avec le nouvel état complet.
4. `move.php` écrit cet état dans `game_state.json` et met à jour le champ `lastUpdate`.
5. Au poll suivant (max 1,5 s), le navigateur de NORD reçoit l'état mis à jour, détecte le changement via `lastUpdate`, et redessine le plateau.

---

## Règles du jeu (résumé)

- Chaque joueur choisit une case non vide de son camp et distribue ses graines une par une dans le circuit : droite vers gauche dans son camp, puis gauche vers droite chez l'adversaire.
- Une **récolte** a lieu quand la dernière graine tombe dans une case adverse contenant 1 à 3 graines (la case passe à 2–4 graines). Prise en chaîne sur les cases précédentes remplissant la même condition.
- **Solidarité :** si le camp adverse est vide, on doit lui envoyer au moins 7 graines.
- **Interdits :** la case 7 ne peut pas semer 1 ou 2 graines chez l'adversaire ; on ne peut pas vider complètement le camp adverse.
- **Victoire :** premier à atteindre 40 graines. Partie nulle si aucun des deux n'y parvient.

---

## Captures d'écran

### Version 1 — Plateau local
> *(à ajouter)*

### Version 2 — Lobby de connexion
> *(à ajouter)*

### Version 2 — Partie en cours
> *(à ajouter)*

---

## Auteur

**Ngankeu Takou Daniel Wilfried**  
Étudiant en Licence 2 Informatique  
Université de Yaoundé I — Faculté des Sciences  
Département d'Informatique
