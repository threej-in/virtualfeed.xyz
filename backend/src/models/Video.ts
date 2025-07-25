import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface VideoAttributes {
  id: number;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string;
  redditId: string;
  subreddit: string;
  platform: string;
  tags: string[];
  views: number;
  likes: number;
  nsfw: boolean;
  blacklisted: boolean;
  metadata: object;
  createdAt?: Date;
  updatedAt?: Date;
}

interface VideoCreationAttributes extends Optional<VideoAttributes, 'id' | 'views' | 'likes' | 'platform'> {}

class Video extends Model<VideoAttributes, VideoCreationAttributes> implements VideoAttributes {
  public id!: number;
  public title!: string;
  public description!: string | null;
  public videoUrl!: string;
  public thumbnailUrl!: string;
  public redditId!: string;
  public subreddit!: string;
  public platform!: string;
  public tags!: string[];
  public views!: number;
  public likes!: number;
  public nsfw!: boolean;
  public blacklisted!: boolean;
  public metadata!: object;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Video.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    videoUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    thumbnailUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    redditId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    subreddit: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    platform: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'reddit',
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    views: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    likes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    nsfw: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    blacklisted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'Video',
    tableName: 'videos',
    timestamps: true,
  }
);

export default Video;
