/**
 * Auto-sauvegarde périodique : toutes les `periodMs`, seulement si le projet est modifié,
 * jamais deux sauvegardes en même temps. Pas de debounce : une modification continue
 * ne repousse donc jamais la sauvegarde.
 */
export default class AutoSaver {
    constructor ({
        save,
        onError = () => {},
        periodMs = 30000,
        // Liés à window : appelés comme this.setTimer(...), les minuteurs natifs lèvent
        // « Illegal invocation » car ils perdent leur receveur.
        setTimer = (...args) => setInterval(...args),
        clearTimer = (...args) => clearInterval(...args)
    }) {
        this.save = save;
        this.onError = onError;
        this.periodMs = periodMs;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
        this.dirty = false;
        this.inFlight = null;
        this.timer = null;
        this.tick = this.tick.bind(this);
    }

    start () {
        this.timer = this.setTimer(this.tick, this.periodMs);
    }

    stop () {
        this.clearTimer(this.timer);
        this.timer = null;
    }

    markDirty () {
        this.dirty = true;
    }

    markClean () {
        this.dirty = false;
    }

    async tick () {
        try {
            await this.flush();
        } catch (error) {
            this.onError(error);
        }
    }

    /**
     * Sauvegarde si le projet est modifié (ou si `force`). Attend d'abord une sauvegarde en cours.
     * Renvoie le résultat de `save`, ou null si rien n'était à sauvegarder. Propage l'erreur.
     * @param {boolean} force - sauvegarder même si le projet n'est pas modifié
     * @returns {Promise<object|null>} le résultat de `save`, ou null
     */
    async flush (force = false) {
        if (this.inFlight) {
            await this.inFlight.catch(() => {});
        }
        if (!force && !this.dirty) return null;
        this.dirty = false;
        const run = this.save();
        this.inFlight = run;
        try {
            return await run;
        } catch (error) {
            this.dirty = true; // la période suivante réessaiera
            throw error;
        } finally {
            if (this.inFlight === run) this.inFlight = null;
        }
    }
}
