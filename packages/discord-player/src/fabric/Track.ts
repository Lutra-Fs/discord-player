import { User, escapeMarkdown, SnowflakeUtil, GuildVoiceChannelResolvable } from 'discord.js';
import { Player, PlayerNodeInitializationResult, PlayerNodeInitializerOptions } from '../Player';
import { RawTrackData, SearchQueryType, TrackJSON } from '../types/types';
import { Playlist } from './Playlist';
import { GuildQueue } from '../manager/GuildQueue';
import { BaseExtractor } from '../extractors/BaseExtractor';
import { Collection } from '@discord-player/utils';

export type TrackResolvable = Track | string | number;

export type WithMetadata<T extends object, M> = T & {
    metadata: M;
    requestMetadata(): Promise<M>;
};

export class Track<T = unknown> {
    public title: string;
    public description: string;
    public author: string;
    public url: string;
    public thumbnail: string;
    public duration: string;
    public views: number;
    public requestedBy: User | null = null;
    public playlist?: Playlist;
    public queryType: SearchQueryType | null | undefined = null;
    public raw: RawTrackData = {
        source: 'arbitrary'
    } as RawTrackData;
    public extractor: BaseExtractor | null = null;
    public readonly id = SnowflakeUtil.generate().toString();
    private __metadata: T | null = null;
    private __reqMetadataFn: () => Promise<T | null>;

    /**
     * Track constructor
     * @param player The player that instantiated this Track
     * @param data Track data
     */
    public constructor(public readonly player: Player, data: Partial<WithMetadata<RawTrackData, T>>) {
        this.title = escapeMarkdown(data.title ?? '');
        this.author = data.author ?? '';
        this.url = data.url ?? '';
        this.thumbnail = data.thumbnail ?? '';
        this.duration = data.duration ?? '';
        this.views = data.views ?? 0;
        this.queryType = data.queryType;
        this.requestedBy = data.requestedBy || null;
        this.playlist = data.playlist;
        this.description = `${this.title} by ${this.author}`;
        this.raw = Object.assign({}, { source: data.raw?.source ?? data.source }, data.raw ?? data);
        this.__metadata = data.metadata ?? null;
        this.__reqMetadataFn = data.requestMetadata || (() => Promise.resolve<T | null>(null));
    }

    /**
     * Request metadata for this track
     */
    public async requestMetadata() {
        const res = await this.__reqMetadataFn();

        this.setMetadata(res);

        return res;
    }

    /**
     * Set metadata for this track
     */
    public setMetadata(m: T | null) {
        this.__metadata = m;
    }

    /**
     * Metadata of this track
     */
    public get metadata() {
        return this.__metadata;
    }

    /**
     * If this track has metadata
     */
    public get hasMetadata() {
        return this.metadata != null;
    }

    /**
     * The queue in which this track is located
     */
    public get queue(): GuildQueue {
        return this.player.nodes.cache.find((q) => q.tracks.some((ab) => ab.id === this.id))!;
    }

    /**
     * The track duration in millisecond
     */
    public get durationMS(): number {
        const times = (n: number, t: number) => {
            let tn = 1;
            for (let i = 0; i < t; i++) tn *= n;
            return t <= 0 ? 1000 : tn * 1000;
        };

        return this.duration
            .split(':')
            .reverse()
            .map((m, i) => parseInt(m) * times(60, i))
            .reduce((a, c) => a + c, 0);
    }

    /**
     * Returns source of this track
     */
    public get source() {
        return this.raw?.source ?? 'arbitrary';
    }

    /**
     * String representation of this track
     */
    public toString(): string {
        return `${this.title} by ${this.author}`;
    }

    /**
     * Raw JSON representation of this track
     */
    public toJSON(hidePlaylist?: boolean) {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            author: this.author,
            url: this.url,
            thumbnail: this.thumbnail,
            duration: this.duration,
            durationMS: this.durationMS,
            views: this.views,
            requestedBy: this.requestedBy?.id || null,
            playlist: hidePlaylist ? null : this.playlist?.toJSON() ?? null
        } as TrackJSON;
    }

    /**
     * Get belonging queues of this track
     */
    public getBelongingQueues() {
        const nodes = this.player.nodes.cache.filter((node) => node.tracks.some((t) => t.id === this.id));

        return nodes as Collection<string, GuildQueue<unknown>>;
    }

    /**
     * Play this track to the given voice channel. If queue exists and another track is being played, this track will be added to the queue.
     * @param channel Voice channel on which this track shall be played
     * @param options Node initialization options
     */
    public async play<T = unknown>(channel: GuildVoiceChannelResolvable, options?: PlayerNodeInitializerOptions<T>): Promise<PlayerNodeInitializationResult<T>> {
        const fn = this.player.play.bind(this.player);

        return await fn(channel, this, options);
    }
}
