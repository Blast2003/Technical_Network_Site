CREATE DATABASE  IF NOT EXISTS `social_networking` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */;
USE `social_networking`;
-- MySQL dump 10.13  Distrib 8.0.36, for Win64 (x86_64)
--
-- Host: gateway01.us-west-2.prod.aws.tidbcloud.com    Database: social_networking
-- ------------------------------------------------------
-- Server version	5.7.28-TiDB-Serverless

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `conversationparticipants`
--

DROP TABLE IF EXISTS `conversationparticipants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversationparticipants` (
  `conversation_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`conversation_id`,`user_id`) /*T![clustered_index] CLUSTERED */,
  KEY `user_id` (`user_id`),
  CONSTRAINT `conversationparticipants_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `social_networking`.`conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversationparticipants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `social_networking`.`users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversationparticipants`
--

LOCK TABLES `conversationparticipants` WRITE;
/*!40000 ALTER TABLE `conversationparticipants` DISABLE KEYS */;
INSERT INTO `conversationparticipants` VALUES (1,1),(1,2),(2,1),(2,3),(3,1),(3,6),(12,1),(12,4),(30015,2),(30015,7),(60015,1),(60015,7);
/*!40000 ALTER TABLE `conversationparticipants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_INCREMENT=90015;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversations`
--

LOCK TABLES `conversations` WRITE;
/*!40000 ALTER TABLE `conversations` DISABLE KEYS */;
INSERT INTO `conversations` VALUES (1,'2025-01-11 04:02:57','2025-01-11 04:02:57'),(2,'2025-01-11 04:02:57','2025-01-11 04:02:57'),(3,'2025-01-18 13:03:43','2025-01-18 13:03:43'),(12,'2025-02-10 10:49:52','2025-02-10 10:49:52'),(13,'2025-02-14 05:47:18','2025-02-14 05:47:18'),(14,'2025-02-14 07:32:03','2025-02-14 07:32:03'),(30015,'2025-03-26 03:38:29','2025-03-26 03:38:29'),(60015,'2025-03-26 14:03:35','2025-03-26 14:03:35');
/*!40000 ALTER TABLE `conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `followers`
--

DROP TABLE IF EXISTS `followers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `followers` (
  `follower_id` int(11) NOT NULL,
  `following_id` int(11) NOT NULL,
  PRIMARY KEY (`follower_id`,`following_id`) /*T![clustered_index] CLUSTERED */,
  KEY `following_id` (`following_id`),
  CONSTRAINT `followers_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `social_networking`.`users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `followers_ibfk_2` FOREIGN KEY (`following_id`) REFERENCES `social_networking`.`users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `followers`
--

LOCK TABLES `followers` WRITE;
/*!40000 ALTER TABLE `followers` DISABLE KEYS */;
INSERT INTO `followers` VALUES (1,2),(1,3),(1,4),(1,5),(1,6),(1,10),(2,1),(2,4),(2,6),(2,9),(2,10),(2,25),(3,2),(3,10),(4,2),(6,2),(6,10),(7,2),(7,25),(10,1),(10,2);
/*!40000 ALTER TABLE `followers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `text` text COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `seen` tinyint(1) DEFAULT '0',
  `img` varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT '',
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastMessage` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_INCREMENT=270069;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES (1,'Test send message',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(2,'Test for sending the second message',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(3,'Reply your test message',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(4,'Testing!',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(5,'Testing 2 !',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(6,'Testing 3!',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(7,'Testing 4!',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(8,'Testing 5!',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(9,'Testing 6',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(10,'testing 7',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(11,'Testing 8',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(12,'hi avcb',1,'','2025-01-11 04:04:03','2025-03-26 03:48:16',0),(13,'hello',0,'','2025-01-11 04:04:03','2025-02-07 02:46:59',0),(14,'nice to meet you',0,'','2025-01-11 04:04:03','2025-02-07 02:46:59',1),(15,'hi',1,'','2025-01-11 04:04:03','2025-03-26 13:51:06',0),(16,'Test send message again',1,'','2025-01-11 04:19:47','2025-03-26 13:51:06',0),(17,'Test send message one more time!',1,'https://res.cloudinary.com/dqgdjmyrs/image/upload/v1724123069/nhd93yhbt1vzhhnr9krr.jpg','2025-01-11 04:20:49','2025-03-26 13:51:06',0),(18,'Hello My Fen',1,'','2025-01-18 13:02:15','2025-03-26 13:51:06',0),(19,'Hi. Nice to meet you Blast1.',1,'','2025-01-18 13:03:43','2025-02-10 04:44:37',0),(22,'Are you there?',1,'','2025-02-07 02:14:37','2025-02-10 04:44:37',0),(24,'I\'m here.',1,'','2025-02-07 02:40:36','2025-02-10 04:44:37',0),(25,'I have some problems, can i ask you ...',1,'','2025-02-07 04:13:17','2025-02-10 04:44:37',0),(26,'yes. Let\'s ask something bro.',1,'','2025-02-07 07:43:09','2025-02-10 04:44:37',0),(33,'Do u think cyber security is important?',1,'','2025-02-07 09:42:26','2025-02-10 04:44:37',0),(34,'yes',1,'','2025-02-07 09:45:06','2025-02-10 04:44:37',0),(35,'that sounds great!',1,'','2025-02-07 09:47:58','2025-02-10 04:44:37',0),(46,'Do u think this image looks cool?',0,'https://res.cloudinary.com/dqgdjmyrs/image/upload/v1739152940/i3di1hcqkzv5bhhnpyhf.png','2025-02-10 02:02:22','2025-02-10 04:44:57',1),(58,'a',1,'','2025-02-10 10:49:52','2025-02-14 06:21:04',0),(59,'abc',1,'','2025-02-10 10:49:54','2025-02-14 06:22:09',1),(30069,'hi',1,'','2025-03-26 03:38:30','2025-03-26 03:39:37',1),(60069,'hi',1,'','2025-03-26 03:48:06','2025-03-26 13:51:06',0),(90069,'hello',1,'','2025-03-26 10:37:08','2025-03-26 13:51:06',0),(90070,'What\'s up, bro?',1,'','2025-03-26 10:39:55','2025-03-26 13:51:06',0),(90071,'i want to ask some problem...',1,'','2025-03-26 10:48:24','2025-03-26 13:51:06',0),(90072,'huh?',1,'','2025-03-26 10:49:39','2025-03-26 13:51:06',0),(120069,'okay, let\'s ask something',1,'','2025-03-26 11:12:01','2025-03-26 13:51:06',0),(150069,'um...',1,'','2025-03-26 13:51:06','2025-03-26 13:51:13',1),(150070,'hi',1,'','2025-03-26 14:03:36','2025-04-06 02:24:25',0),(180069,'hello',1,'','2025-03-26 14:08:46','2025-04-06 02:24:25',0),(210069,'How are you today?',1,'','2025-04-06 01:24:15','2025-04-06 02:24:25',0),(210070,'hi...',1,'','2025-04-06 01:26:44','2025-04-06 02:24:25',0),(210071,'What?',1,'','2025-04-06 01:31:41','2025-04-06 02:24:25',0),(210072,'Are u okay?',1,'','2025-04-06 01:32:56','2025-04-06 02:24:25',0),(210073,'I just testing...',1,'','2025-04-06 01:35:06','2025-04-06 02:24:25',0),(210074,'hmm?',1,'','2025-04-06 01:35:40','2025-04-06 02:24:25',0),(240069,'okay',1,'','2025-04-06 01:46:09','2025-04-06 02:24:25',0),(240070,'okay, you can test...',1,'','2025-04-06 01:47:12','2025-04-06 02:24:25',0),(240071,'thanks bro!',1,'','2025-04-06 01:53:57','2025-04-06 02:24:25',0),(240072,'no problem @@',1,'','2025-04-06 02:18:51','2025-04-06 02:24:25',0),(240073,'oke oke @@',1,'','2025-04-06 02:24:25','2025-04-06 02:24:26',1);
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messagesconversation`
--

DROP TABLE IF EXISTS `messagesconversation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messagesconversation` (
  `message_id` int(11) NOT NULL,
  `conversation_id` int(11) NOT NULL,
  PRIMARY KEY (`message_id`,`conversation_id`) /*T![clustered_index] CLUSTERED */,
  KEY `messagesConversation_ibfk_2` (`conversation_id`),
  CONSTRAINT `messagesConversation_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `social_networking`.`messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messagesConversation_ibfk_2` FOREIGN KEY (`conversation_id`) REFERENCES `social_networking`.`conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messagesconversation`
--

LOCK TABLES `messagesconversation` WRITE;
/*!40000 ALTER TABLE `messagesconversation` DISABLE KEYS */;
INSERT INTO `messagesconversation` VALUES (1,1),(2,1),(3,1),(4,1),(5,1),(6,1),(7,1),(8,1),(9,1),(10,1),(11,1),(12,2),(13,2),(14,2),(15,1),(16,1),(17,1),(18,1),(19,3),(22,3),(24,3),(25,3),(26,3),(33,3),(34,3),(35,3),(46,3),(58,12),(59,12),(30069,30015),(60069,1),(90069,1),(90070,1),(90071,1),(90072,1),(120069,1),(150069,1),(150070,60015),(180069,60015),(210069,60015),(210070,60015),(210071,60015),(210072,60015),(210073,60015),(210074,60015),(240069,60015),(240070,60015),(240071,60015),(240072,60015),(240073,60015);
/*!40000 ALTER TABLE `messagesconversation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messagessender`
--

DROP TABLE IF EXISTS `messagessender`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messagessender` (
  `user_id` int(11) NOT NULL,
  `message_id` int(11) NOT NULL,
  PRIMARY KEY (`user_id`,`message_id`) /*T![clustered_index] CLUSTERED */,
  KEY `messagesSender_ibfk_2` (`message_id`),
  CONSTRAINT `messagesSender_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `social_networking`.`users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messagesSender_ibfk_2` FOREIGN KEY (`message_id`) REFERENCES `social_networking`.`messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messagessender`
--

LOCK TABLES `messagessender` WRITE;
/*!40000 ALTER TABLE `messagessender` DISABLE KEYS */;
INSERT INTO `messagessender` VALUES (1,1),(1,2),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),(1,10),(1,11),(1,13),(1,14),(1,18),(1,19),(1,22),(1,25),(1,33),(1,35),(1,46),(1,58),(1,59),(1,90069),(1,90071),(1,120069),(1,180069),(1,210072),(1,240069),(1,240071),(1,240073),(2,3),(2,15),(2,16),(2,17),(2,60069),(2,90070),(2,90072),(2,150069),(3,12),(6,24),(6,26),(6,34),(7,30069),(7,150070),(7,210069),(7,210070),(7,210071),(7,210073),(7,210074),(7,240070),(7,240072);
/*!40000 ALTER TABLE `messagessender` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `notification_id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_id` int(11) NOT NULL,
  `recipient_id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `action` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `seen` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_notification_sender` (`sender_id`),
  KEY `fk_notification_recipient` (`recipient_id`),
  KEY `fk_notification_post` (`post_id`),
  KEY `idx_notification_createdAt` (`createdAt`),
  CONSTRAINT `fk_notification_post` FOREIGN KEY (`post_id`) REFERENCES `social_networking`.`posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notification_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `social_networking`.`users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notification_sender` FOREIGN KEY (`sender_id`) REFERENCES `social_networking`.`users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_INCREMENT=720061;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (3,2,1,8,'The person you\'re following has made a new post',1,'2025-02-21 04:02:32','2025-02-22 02:14:21'),(4,2,10,8,'The person you\'re following has made a new post',0,'2025-02-21 04:02:34','2025-02-21 03:34:26'),(5,2,1,29,'The person you\'re following has made a new post',1,'2025-02-21 03:34:47','2025-02-22 02:14:21'),(6,2,10,29,'The person you\'re following has made a new post',0,'2025-02-21 03:34:47','2025-02-21 03:34:47'),(8,2,1,3,'A user liked your post',1,'2025-02-21 04:02:53','2025-02-22 02:14:21'),(11,2,1,24,'A user liked your post',1,'2025-02-21 06:17:45','2025-02-22 02:14:21'),(19,2,1,31,'The person you\'re following has made a new post',1,'2025-02-21 08:41:14','2025-02-22 02:14:21'),(20,2,10,31,'The person you\'re following has made a new post',0,'2025-02-21 08:41:14','2025-02-21 08:41:14'),(22,1,2,32,'The person you\'re following has made a new post',0,'2025-02-23 02:29:39','2025-02-23 02:29:39'),(23,1,10,32,'The person you\'re following has made a new post',0,'2025-02-23 02:29:39','2025-02-23 02:29:39'),(24,1,2,33,'The person you\'re following has made a new post',0,'2025-02-23 02:58:02','2025-02-23 02:58:02'),(25,1,10,33,'The person you\'re following has made a new post',0,'2025-02-23 02:58:02','2025-02-23 02:58:02'),(28,1,2,29,'A user replied on your post',0,'2025-02-23 03:16:46','2025-02-23 03:16:46'),(35,10,1,3,'A user liked your post',1,'2025-03-03 01:58:11','2025-03-03 03:26:16'),(39,10,1,3,'A user replied on your post',1,'2025-03-03 02:07:57','2025-03-03 03:26:16'),(42,3,1,3,'A user liked your post',1,'2025-03-03 03:30:34','2025-03-30 04:28:47'),(43,3,1,3,'A user replied on your post',1,'2025-03-03 03:31:43','2025-03-30 04:28:47'),(30066,2,1,30042,'The person you\'re following has made a new post',1,'2025-03-06 02:36:31','2025-03-30 04:28:47'),(30067,2,3,30042,'The person you\'re following has made a new post',0,'2025-03-06 02:36:31','2025-03-06 02:36:31'),(30068,2,4,30042,'The person you\'re following has made a new post',1,'2025-03-06 02:36:31','2025-03-11 08:28:08'),(30069,2,6,30042,'The person you\'re following has made a new post',1,'2025-03-06 02:36:31','2025-03-12 06:53:08'),(30070,2,10,30042,'The person you\'re following has made a new post',0,'2025-03-06 02:36:31','2025-03-06 02:36:31'),(30071,10,3,30043,'The person you\'re following has made a new post',0,'2025-03-06 03:09:31','2025-03-06 03:09:31'),(120066,1,10,30043,'A user liked your post',0,'2025-03-11 10:43:41','2025-03-11 10:43:41'),(120067,1,10,15,'A user liked your post',0,'2025-03-11 10:47:16','2025-03-11 10:47:16'),(120072,1,2,60043,'The person you\'re following has made a new post',0,'2025-03-11 11:12:12','2025-03-11 11:12:12'),(120073,1,10,60043,'The person you\'re following has made a new post',0,'2025-03-11 11:12:12','2025-03-11 11:12:12'),(150061,1,2,30042,'A user liked your post',0,'2025-03-12 01:51:33','2025-03-12 01:51:33'),(180061,2,1,60043,'A user liked your post',1,'2025-03-12 06:12:38','2025-03-30 04:28:47'),(180062,2,1,60043,'A user replied on your post',1,'2025-03-12 06:12:57','2025-03-30 04:28:47'),(180063,2,1,60043,'A user replied on your post',1,'2025-03-12 06:14:17','2025-03-30 04:28:47'),(180064,2,1,60043,'A user replied on your post',1,'2025-03-12 06:15:16','2025-03-30 04:28:47'),(180065,2,1,60043,'A user replied on your post',1,'2025-03-12 06:17:57','2025-03-30 04:28:47'),(210061,2,1,60043,'A user replied on your post',1,'2025-03-12 06:27:40','2025-03-30 04:28:47'),(210062,2,1,60043,'A user replied on your post',1,'2025-03-12 06:28:52','2025-03-30 04:28:47'),(240061,2,1,60043,'A user replied on your post',1,'2025-03-12 06:38:01','2025-03-30 04:28:47'),(240062,2,10,30043,'A user replied on your post',0,'2025-03-12 06:39:08','2025-03-12 06:39:08'),(240063,6,2,30042,'A user liked your post',0,'2025-03-12 06:54:36','2025-03-12 06:54:36'),(270066,1,2,6,'A user replied on your post',0,'2025-03-12 07:43:07','2025-03-12 07:43:07'),(270067,1,2,6,'A user replied on your post',0,'2025-03-12 07:43:17','2025-03-12 07:43:17'),(270068,1,2,6,'A user replied on your post',0,'2025-03-12 07:43:48','2025-03-12 07:43:48'),(300061,7,1,3,'A user liked your post',1,'2025-03-13 10:22:07','2025-03-30 04:28:47'),(330063,1,2,90042,'The person you\'re following has made a new post',0,'2025-03-14 02:20:17','2025-03-14 02:20:17'),(330064,1,10,90042,'The person you\'re following has made a new post',0,'2025-03-14 02:20:17','2025-03-14 02:20:17'),(360067,10,1,90042,'A user liked your post',1,'2025-03-14 02:38:42','2025-03-30 04:28:47'),(360069,10,1,120042,'The person you\'re following has made a new post',1,'2025-03-14 02:54:04','2025-03-30 04:28:47'),(360070,10,2,120042,'The person you\'re following has made a new post',0,'2025-03-14 02:54:04','2025-03-14 02:54:04'),(360071,10,3,120042,'The person you\'re following has made a new post',0,'2025-03-14 02:54:04','2025-03-14 02:54:04'),(360072,10,6,120042,'The person you\'re following has made a new post',0,'2025-03-14 02:54:04','2025-03-14 02:54:04'),(390061,2,1,150041,'The person you\'re following has made a new post',1,'2025-03-14 03:46:12','2025-03-30 04:28:47'),(390062,2,3,150041,'The person you\'re following has made a new post',0,'2025-03-14 03:46:12','2025-03-14 03:46:12'),(390063,2,4,150041,'The person you\'re following has made a new post',0,'2025-03-14 03:46:12','2025-03-14 03:46:12'),(390064,2,6,150041,'The person you\'re following has made a new post',0,'2025-03-14 03:46:12','2025-03-14 03:46:12'),(390065,2,7,150041,'The person you\'re following has made a new post',1,'2025-03-14 03:46:12','2025-03-30 05:05:02'),(390066,2,10,150041,'The person you\'re following has made a new post',0,'2025-03-14 03:46:12','2025-03-14 03:46:12'),(450061,7,2,7,'A user liked your post',0,'2025-03-25 14:18:11','2025-03-25 14:18:11'),(450062,7,2,7,'A user replied on your post',0,'2025-03-25 14:18:39','2025-03-25 14:18:39'),(480061,9,2,180042,'The person you\'re following has made a new post',0,'2025-03-26 03:26:35','2025-03-26 03:26:35'),(480062,9,7,180042,'The person you\'re following has made a new post',1,'2025-03-26 03:26:35','2025-03-30 05:05:02'),(510067,7,2,31,'A user replied on your post',0,'2025-03-30 02:02:09','2025-03-30 02:02:09'),(570064,7,2,31,'A user liked your post',0,'2025-03-30 03:08:17','2025-03-30 03:08:17'),(600063,8,7,210041,'A user liked your post',1,'2025-03-30 05:02:01','2025-03-30 05:05:02'),(600064,8,7,210041,'A user replied on your post',1,'2025-03-30 05:03:42','2025-03-30 05:05:02'),(600065,8,7,210041,'A user replied on your post',1,'2025-03-30 05:04:14','2025-03-30 05:05:02'),(600067,1,3,16,'A user liked your post',0,'2025-03-30 05:08:33','2025-03-30 05:08:33'),(660064,1,2,29,'A user liked your post',0,'2025-03-30 05:57:35','2025-03-30 05:57:35'),(690062,1,2,150041,'A user liked your post',0,'2025-03-30 06:37:22','2025-03-30 06:37:22'),(690063,1,2,150041,'A user replied on your post',0,'2025-03-30 06:37:34','2025-03-30 06:37:34'),(690064,1,10,30043,'A user replied on your post',0,'2025-03-30 06:37:55','2025-03-30 06:37:55');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `postlikes`
--

DROP TABLE IF EXISTS `postlikes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `postlikes` (
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`post_id`,`user_id`) /*T![clustered_index] CLUSTERED */,
  KEY `user_id` (`user_id`),
  CONSTRAINT `postlikes_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `social_networking`.`posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `postlikes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `social_networking`.`users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `postlikes`
--

LOCK TABLES `postlikes` WRITE;
/*!40000 ALTER TABLE `postlikes` DISABLE KEYS */;
INSERT INTO `postlikes` VALUES (3,1),(3,2),(3,3),(3,7),(3,10),(4,2),(5,2),(6,1),(6,2),(7,1),(7,2),(7,7),(8,1),(9,1),(10,1),(14,1),(15,1),(15,3),(16,1),(24,1),(24,2),(26,1),(26,2),(29,1),(31,7),(32,1),(33,1),(30042,1),(30042,6),(30043,1),(60043,1),(60043,2),(90042,10),(120042,10),(150041,1),(210041,8);
/*!40000 ALTER TABLE `postlikes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `postreplies`
--

DROP TABLE IF EXISTS `postreplies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `postreplies` (
  `post_id` int(11) NOT NULL,
  `reply_id` int(11) NOT NULL,
  PRIMARY KEY (`post_id`,`reply_id`) /*T![clustered_index] CLUSTERED */,
  KEY `postreplies_ibfk_2` (`reply_id`),
  CONSTRAINT `postreplies_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `social_networking`.`posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `postreplies_ibfk_2` FOREIGN KEY (`reply_id`) REFERENCES `social_networking`.`replies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `postreplies`
--

LOCK TABLES `postreplies` WRITE;
/*!40000 ALTER TABLE `postreplies` DISABLE KEYS */;
INSERT INTO `postreplies` VALUES (3,61),(3,62),(4,4),(5,5),(5,6),(6,8),(6,9),(6,120070),(6,120071),(6,120072),(7,10),(7,150065),(8,12),(24,54),(29,57),(31,180065),(32,55),(30042,90067),(30043,90066),(30043,240066),(60043,30065),(150041,240065),(210041,210065),(210041,210066);
/*!40000 ALTER TABLE `postreplies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `posts`
--

DROP TABLE IF EXISTS `posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `text` text COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `img` varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `title` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `type` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `hashtag` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `mainField` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `sourceType` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_INCREMENT=240041;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `posts`
--

LOCK TABLES `posts` WRITE;
/*!40000 ALTER TABLE `posts` DISABLE KEYS */;
INSERT INTO `posts` VALUES (3,'Discussing the latest trends in Cybersecurity practices.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723614687/r6ca2saiznrzxso25zjk.png','2025-01-11 04:02:28','2025-03-06 01:57:51','Cybersecurity','Knowledge','#Cybersecurity #DigitalSafety #SecurityTrends','Security & Operations Management',''),(4,'Exploring the second stage of Software Development lifecycle.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723614834/ddf5wvwm9aq3ufwegx9p.png','2025-01-11 04:02:28','2025-03-06 01:57:51','Software Development','Knowledge','#SDLC #SoftwareLifecycle #DevProcess','Software & Application Development',''),(5,'Uncovering advanced AI and Machine Learning techniques to solve complex real-world problems and drive innovation across industries.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723614988/na0mq04wqr3b5sauzcol.jpg','2025-01-11 04:02:28','2025-03-06 01:57:52','AI & Machine Learning','Knowledge','#AI #MachineLearning #Innovation','Data & Intelligence',''),(6,'Analyzing the importance of UX/UI Design in modern applications.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723646481/kz5ikmxapgkzx4q1wkpn.webp','2025-01-11 04:02:28','2025-03-06 01:57:52','UX/UI Design','Knowledge','#UXUIDesign #UserExperience #DigitalDesign','Software & Application Development',''),(7,'Emphasizing the significance of Software Testing in quality assurance.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723646779/ijgea9iveai2mvgy0bfy.jpg','2025-01-11 04:02:28','2025-03-06 01:57:52','Software Testing','Knowledge','#SoftwareTesting #QualityAssurance #QA','Software & Application Development',''),(8,'Highlighting how intuitive UX/UI design elevates user experiences and drives engagement by creating visually appealing and user-friendly interfaces.',NULL,'2025-01-11 04:02:28','2025-03-06 01:57:53','UX/UI Design','Knowledge','#UXUIDesign #UserExperience #DigitalDesign','Software & Application Development',''),(9,'Exploring innovative cybersecurity strategies designed to safeguard digital assets against emerging threats in an ever-evolving cyber landscape.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1724124619/pjgicfxqkso9is0qh7sb.jpg','2025-01-11 04:02:28','2025-03-06 01:57:53','Cybersecurity','Knowledge','#Cybersecurity #DigitalSafety #SecurityTrends','Security & Operations Management',''),(10,'Learning about Software Development best practices.','https://bigohtech.com/wp-content/uploads/2023/09/software-development-practices.webp','2025-01-11 04:02:28','2025-03-06 01:57:53','Software Development','Knowledge','#SoftwareDevelopment #BestPractices #CodingStandards','Software & Application Development',''),(11,'Exploring essential software development best practices that promote efficiency, maintainability, and innovation in code management and project execution.',NULL,'2025-01-11 04:02:28','2025-03-06 01:57:54','Software Development','Knowledge','#SoftwareDevelopment #BestPractices #CodingStandards','Software & Application Development',''),(12,'Clean code is happy code!  A few simple principles can make your code more readable, maintainable, and efficient. Check out our latest blog post on best practices for writing clean code.','','2025-02-04 04:20:56','2025-03-06 01:57:54','Software Development','Knowledge','#softwaredevelopment #codingbestpractices #cleancode','Software & Application Development',''),(14,'The full Software Development Life Cycle.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738747991/ibeaok0mxcfgpjln7hdm.png','2025-02-05 09:33:12','2025-03-06 01:57:55','Software Development','Knowledge','#SDLC #RequirementsAnalysis #SoftwareDevelopment','Software & Application Development',''),(15,'Cybersecurity is more than just a job; it\'s a mission to protect our digital world. As a Cybersecurity Engineer, I\'m passionate about building secure and resilient systems that can withstand the ever-evolving threat scape. I\'m always learning and growing, and I\'m excited to share my knowledge and experience with others.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738808097/mi5ervnxsnmkysgsnru4.png','2025-02-06 02:14:57','2025-03-06 01:57:55','Cybersecurity','Knowledge','#Cybersecurity #InfoSec #CyberEngineer','Security & Operations Management',''),(16,'Blockchain and cryptocurrency are revolutionizing the world of finance and technology. Blockchain is a secure, transparent, and decentralized ledger that records transactions across multiple computers. This makes it difficult to alter or hack the data. Cryptocurrency is a digital or virtual currency that uses cryptography for security.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1739261897/zzqev94ceghlj4xx0ie1.jpg','2025-02-11 08:18:18','2025-03-06 01:57:55','Blockchain & Cryptocurrency','Knowledge','#Blockchain #Cryptocurrency #Fintech','Emerging Technologies',''),(24,'Exploring the intersection of art and functionality. Here\'s a glimpse into my recent work as a Digital Artist & UI Designer.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1740026777/z3yayihau1kbrrakrfq3.png','2025-02-20 04:46:18','2025-03-06 01:57:56','UX/UI Design','Knowledge','#UXUIDesign #UserExperience #DigitalDesign','Software & Application Development',''),(26,'? RECRUITMENT OF WEB DEVELOPMENT INTERNS ?\n? Target:\n3rd, 4th year students or recent graduates majoring in Information Technology, Computer Science or related fields.\n? Benefits:\nTraining: Mentor guidance, improving basic web programming skills.\nPractical learning: Participate in real projects in a professional environment.\nSupport: Internship confirmation and other benefits according to company policy.\nDevelopment opportunities: Consider becoming an official employee if performing well.\n?','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1740032426/ow2yov0ljqqucmicn9ve.jpg','2025-02-20 06:20:27','2025-03-14 01:43:33','Software Development','Recruitment','#webdevintern #internship #programming #informationtechnology #SoftwareDevelopment #applynow','Software & Application Development','enterprise'),(29,'I\'m excited to share my latest data science project! I recently built a sentiment analysis model to understand customer opinions about movies based on their reviews.  This project was a fascinating deep dive into Natural Language Processing (NLP) and provided some really interesting insights.',NULL,'2025-02-21 03:34:47','2025-03-06 01:57:56','Data Scientist','Knowledge','#DataScience #MachineLearning #DeepLearning','Data & Intelligence',''),(31,'Pandas is a Data Scientist\'s best friend!  This Python library makes data manipulation a breeze.  From reading and writing data in various formats (CSV, Excel, etc.) to cleaning, transforming, and analyzing data, Pandas has you covered.  Its DataFrame object is incredibly powerful.  What are your favorite Pandas tricks? Share in the comments!','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1740127273/b17q07wd3ezhowfbqlws.png','2025-02-21 08:41:14','2025-03-06 01:57:57','Data Science','Knowledge','#python #pandas #dataframe #dataanalysis #datamanipulation #datascience #programming #coding #datascientist #machinelearning\"','Data & Intelligence',''),(32,'Deep dive into the requirements analysis phase of the Software Development Life Cycle, where clear project goals are defined and user needs are mapped out.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1740277778/jll4u0kp50qdpemj137e.jpg','2025-02-23 02:29:39','2025-03-06 01:57:57','Software Development','Knowledge','#SDLC #RequirementsAnalysis #SoftwareDevelopment','Software & Application Development',''),(33,'Diving deeper into AI & Machine Learning algorithms.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1740279481/bbpfg5smu5nudmvflcnu.jpg','2025-02-23 02:58:02','2025-03-06 01:57:58','AI & Machine Learning','Knowledge','#AI #MachineLearning #Innovation','Data & Intelligence',''),(30042,'[HBT, HN] IT company looking for WEB SYSTEM ENGINEER INTERN/FRESHER/JUNIOR CANDIDATES\n-----\nWorking hours: 2 time slots from 8am-5pm/9am-6pm from Monday to Friday\nAddress: Hai Ba Trung, Hanoi\nInterested candidates inbox to send specific JD or send CV via email: recruitment@otani.vn','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1741228588/fbxduznex4idclavuzhf.jpg','2025-03-06 02:36:29','2025-03-14 01:43:33','Software Development','Recruitment','#HBT #HN #ITJobs #WebSystemEngineer #Internship #FresherJobs #JuniorDeveloper #HanoiJobs #WebDev','Software & Application Development','enterprise'),(30043,'VACANCY ANNOUNCEMENT \nPOSITION :Implementation Engineer - Cybersecurity \nSOURCE: NYASAJOB.COM\nABOUT THE JOB\nWe are seeking an honest, hardworking, and dynamic individual to join our team as aImplementation Engineer - Cybersecurity.The ideal candidate should have over 6-7 years of experience in cybersecurity implementation, SOC operations, and security infrastructure deployment.\nCHECK RECENT JOBS\nhttps://nyasajob.com','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1741230568/ai8m8pfnrne4q3hruiuo.jpg','2025-03-06 03:09:29','2025-03-14 01:43:34','Cybersecurity','Recruitment','#NowHiring #JobSearch #CareerOpportunities #Hiring #JobOpening #WorkFromHome #JobVacancy #Employment #JobSeekers #FindAJob #Recruitment #JobAlert #HiringNow #CareerGrowth #DreamJob #JobHunting #Resume','Security & Operations Management','enterprise'),(60043,'Exploring the fusion of creativity and technology—every pixel tells a story! As a digital artist and UI designer, I’m passionate about crafting experiences that are both visually captivating and user-friendly. My work is all about blending art with functionality to create designs that inspire and engage. Stay tuned for a closer look at my creative process and my latest projects. Let’s push the boundaries of digital design together!','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1741691529/qhhkluu6roc1wathxcfb.jpg','2025-03-11 11:12:10','2025-03-11 11:12:10','UX/UI Design','Knowledge','#DigitalArt #UIDesign #CreativeTech','Software & Application Development',''),(90042,'I have the post content, give me the topic: Hello everyone, our IT company is currently opening the following Freelancer positions:\n\n04 Shopify Developer Freelancer [Middle-level]\n\n02 Magento Developer Freelancer [Senior-level]\n01 PHP Developer Freelancer [Senior-level]\n02 Next.js Development Freelancer [Middle-level]\n\n👉If you are interested, please comment/inbox me and I will send you a JD or send your CV directly to email: hire@mail.wgentech.com with the title [WGT - Position Name] Full Name',NULL,'2025-03-14 02:20:14','2025-03-14 02:20:14','Hiring Freelance Developers (Shopify, Magento, PHP, Next.js)','Recruitment','#freelancer #jobopportunity #webdevelopment','Software & Application Development','freelancer'),(120042,'As a Cybersecurity Engineer, I\'m passionate about more than just patching vulnerabilities. I\'m building the future of secure systems. We\'re exploring cutting-edge technologies like AI-driven threat detection, quantum-resistant cryptography, and zero-trust architectures to stay ahead of evolving threats.\n\nIt\'s an exciting time to be in cybersecurity, where innovation is the key to protecting our digital world. What are you most excited about in the future of security?','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1741920842/nhaene9rp1txbmkclsjf.png','2025-03-14 02:54:02','2025-03-14 02:54:02','Building Tomorrow\'s Defenses: Where Cybersecurity Meets Innovation','Knowledge','#Cybersecurity #TechInnovation #AIsecurity','Security & Operations Management',''),(150041,'Corner for finding freelancer or part-time / full-time remote jobs.\n \n Hello everyone.\n I am currently looking for another freelancer job or part-time / full-time remote job with the position: python dev or ML engineer.\n \n About my skills as follows.\n Programming Language:\n 1. Python: 3 years+.\n 2. Golang: 1 year+.\n Skills:\n 1. Rest API.\n 2. My AI / ML domain is NLP.\n 3. Chatbot: Rasa framework.\n English:\n 1. Can communicate + good writing skills.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1741923969/mxqt43v053zgqzbyzen9.jpg','2025-03-14 03:46:10','2025-03-14 03:46:10','Seeking Remote Python Dev/ML Engineer Opportunities','Recruitment','#remotework #freelance #machinelearning #pythondeveloper','Data & Intelligence','freelancer'),(180041,'Ever wonder what goes on behind the scenes to keep our digital world safe? As a Security Analyst, my days are a blend of threat hunting, vulnerability assessments, and incident response. From analyzing network traffic for suspicious activity to patching critical systems, we\'re the first line of defense against cyber threats. It\'s a constant learning curve, adapting to the ever-evolving landscape of cybercrime. Every solved alert and mitigated risk is a win for digital security. What\'s your take ','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1742959173/a9cszelm7gysnulyj0dl.jpg','2025-03-26 03:19:35','2025-03-26 03:19:35','Decoding Digital Threats: A Day in the Life of a Security Analyst','Knowledge','#Cybersecurity #SecurityAnalyst #InfoSec #ThreatHunting #IncidentResponse #CyberAware #DigitalSecurity #TechJobs #CyberDefense','Security & Operations Management',''),(180042,'Designing robust security architectures is more than just drawing diagrams; it\'s about anticipating future threats and building resilient systems from the ground up. As a Security Architect, I spend my days crafting secure cloud environments, defining access controls, and ensuring data integrity. It\'s a strategic role, balancing innovation with ironclad security. We\'re the planners, the strategists, ensuring that security is woven into the very fabric of an organization\'s technology. What are yo','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1742959591/jiesqzafalhniimcj15l.png','2025-03-26 03:26:32','2025-03-26 03:26:32','Building Fortresses in the Cloud: The Architect\'s Blueprint','Knowledge','#SecurityArchitecture #CloudSecurity #Cybersecurity #InfoSec #SecurityDesign #NetworkSecurity #DataSecurity #TechJobs #InfraSec #CyberArchitect','Security & Operations Management',''),(210041,'As a junior AI Software Engineer, I\'m incredibly excited to be exploring the intersection of AI and cybersecurity. Every day is a new opportunity to learn and experiment with machine learning techniques for threat detection. I\'m passionate about building intelligent security systems that can adapt and evolve to stay ahead of emerging threats. The learning curve is steep, but the potential is immense! Let\'s build a safer digital world together. Any tips or resources for a junior engineer keen to ','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1743310549/faxqjhsdrnytwq9afnf8.png','2025-03-30 04:55:50','2025-03-30 04:55:50','Diving Deep into AI for Cybersecurity!','Knowledge','#AI #Cybersecurity #MachineLearning #JuniorEngineer #TechJourney #Innovation','Security & Operations Management','');
/*!40000 ALTER TABLE `posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `replies`
--

DROP TABLE IF EXISTS `replies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `replies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `text` text COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `username` varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `userProfilePic` text COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_INCREMENT=270065;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `replies`
--

LOCK TABLES `replies` WRITE;
/*!40000 ALTER TABLE `replies` DISABLE KEYS */;
INSERT INTO `replies` VALUES (1,'The third text update to reply','2025-01-11 04:02:51','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(2,'The fourth text update to reply','2025-01-11 04:02:52','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(3,'The fifth reply','2025-01-11 04:02:53','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(4,'That\'s cool','2025-01-11 04:02:51','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(5,'Test Reply','2025-01-11 04:02:51','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(6,'New Reply here','2025-01-11 04:02:51','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(8,'Test self-reply','2025-01-11 04:02:51','2025-01-18 06:06:47','BACD_updated','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723694609/hqhljuvgyakhiaydssrd.jpg'),(9,'The Post Looks Cool','2025-01-19 03:40:47','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(10,'This topic is so interesting!','2025-02-04 03:34:25','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(11,'Quite Hard!','2025-02-04 03:38:45','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(12,'I\'m interested!','2025-02-04 03:40:02','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(13,'That looks great!','2025-02-04 03:40:02','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(14,'Yes, that\'s really great!','2025-02-05 03:55:19','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(37,'I think this topic quite boring :((','2025-02-05 15:03:30','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(43,'The Post Looks Cool','2025-02-21 01:56:31','2025-02-21 01:56:31','BACD_updated','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723694609/hqhljuvgyakhiaydssrd.jpg'),(46,'That\'s an interesting topic!','2025-02-21 04:04:59','2025-02-21 04:04:59','BACD_updated','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723694609/hqhljuvgyakhiaydssrd.jpg'),(54,'Let\'s discuss about this topic.','2025-02-21 08:48:47','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(55,'What do you think about this issue?','2025-02-23 02:46:06','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(57,'That \'s an interesting topic!','2025-02-23 03:16:46','2025-03-12 01:53:20','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(61,'That\'s a trending topic!','2025-03-03 02:07:57','2025-03-03 02:10:02','Thang','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738807877/thsfh16blqv9njzbcrnw.webp'),(62,'Let\'s discuss more about this topic.','2025-03-03 03:31:43','2025-03-03 03:31:43','Blast','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1724142786/atrvyo6k4spa8q3fxx7v.jpg'),(64,'That\'s awesome!','2025-03-03 10:52:07','2025-03-03 10:52:07','BACD_updated','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723694609/hqhljuvgyakhiaydssrd.jpg'),(30065,'That\'s sound great!','2025-03-12 06:12:56','2025-03-12 06:12:56','BACD_updated','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723694609/hqhljuvgyakhiaydssrd.jpg'),(90066,'ib','2025-03-12 06:39:06','2025-03-12 06:39:06','BACD_updated','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723694609/hqhljuvgyakhiaydssrd.jpg'),(90067,'ib','2025-03-12 06:39:22','2025-03-12 06:39:22','BACD_updated','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723694609/hqhljuvgyakhiaydssrd.jpg'),(120070,'Test Reply 1.','2025-03-12 07:43:05','2025-03-12 07:43:05','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(120071,'ib','2025-03-12 07:43:17','2025-03-12 07:43:17','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(120072,'Cool!','2025-03-12 07:43:47','2025-03-12 07:43:47','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(150065,'I also think that!','2025-03-25 14:18:38','2025-03-25 14:18:38','Hau1','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1741860922/q0zmbk9fitojefupwscz.jpg'),(180065,'That is an interesting topic!','2025-03-30 01:55:10','2025-03-30 01:55:10','Hau1','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1741860922/q0zmbk9fitojefupwscz.jpg'),(210065,'That is an interesting topic!','2025-03-30 05:03:40','2025-03-30 05:03:40','Tien',NULL),(210066,'Wow!','2025-03-30 05:04:13','2025-03-30 05:04:13','Tien',NULL),(240065,'Ib','2025-03-30 06:37:33','2025-03-30 06:37:33','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg'),(240066,'Ib','2025-03-30 06:37:54','2025-03-30 06:37:54','B3AC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg');
/*!40000 ALTER TABLE `replies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `repliesuser`
--

DROP TABLE IF EXISTS `repliesuser`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `repliesuser` (
  `user_id` int(11) NOT NULL,
  `reply_id` int(11) NOT NULL,
  PRIMARY KEY (`user_id`,`reply_id`) /*T![clustered_index] CLUSTERED */,
  KEY `repliesUser_ibfk_2` (`reply_id`),
  CONSTRAINT `repliesUser_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `social_networking`.`users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `repliesUser_ibfk_2` FOREIGN KEY (`reply_id`) REFERENCES `social_networking`.`replies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `repliesuser`
--

LOCK TABLES `repliesuser` WRITE;
/*!40000 ALTER TABLE `repliesuser` DISABLE KEYS */;
INSERT INTO `repliesuser` VALUES (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,9),(1,10),(1,11),(1,12),(1,13),(1,14),(1,37),(1,54),(1,55),(1,57),(1,120070),(1,120071),(1,120072),(1,240065),(1,240066),(2,8),(2,43),(2,46),(2,64),(2,30065),(2,90066),(2,90067),(3,62),(7,150065),(7,180065),(8,210065),(8,210066),(10,61);
/*!40000 ALTER TABLE `repliesuser` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `userposts`
--

DROP TABLE IF EXISTS `userposts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `userposts` (
  `user_id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  PRIMARY KEY (`user_id`,`post_id`) /*T![clustered_index] CLUSTERED */,
  KEY `userposts_ibfk_2` (`post_id`),
  CONSTRAINT `userposts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `social_networking`.`users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `userposts_ibfk_2` FOREIGN KEY (`post_id`) REFERENCES `social_networking`.`posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `userposts`
--

LOCK TABLES `userposts` WRITE;
/*!40000 ALTER TABLE `userposts` DISABLE KEYS */;
INSERT INTO `userposts` VALUES (1,3),(1,4),(1,5),(1,11),(1,12),(1,14),(1,24),(1,26),(1,32),(1,33),(1,60043),(1,90042),(2,6),(2,7),(2,8),(2,29),(2,31),(2,30042),(2,150041),(3,9),(3,16),(4,10),(7,210041),(8,180041),(9,180042),(10,15),(10,30043),(10,120042);
/*!40000 ALTER TABLE `userposts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `username` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `profilePic` varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT '',
  `bio` text COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `isFrozen` tinyint(1) DEFAULT '0',
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `position` varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_INCREMENT=60026;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Alan','B3AC','test@gmail.com','$2a$10$C2Q7HIIkZeVVR6ZPXq.HAezCVa7b9UI2m.liK2fuAcKxH2sv5DvZK','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738749944/o0kuma8cvklsombutc8q.jpg','Creating beautiful digital art and UI designs. Available for freelance work. Based in San Francisco, CA.',0,'2025-01-11 04:01:48','2025-02-21 11:03:49','Digital Artist & UI Designer'),(2,'test2','BACD_updated','test1@gmail.com','$2a$10$0StZUfPi73Sith/K9z8iRO9b4Cklfm8eEk.sCzrqyHn/USgt02niS','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1723694609/hqhljuvgyakhiaydssrd.jpg','Data Scientist driven by the desire to solve complex problems with data.  Experienced in building predictive models and developing data-driven solutions that make a real-world impact.',0,'2025-01-11 04:01:48','2025-03-11 10:55:22','Data Scientist'),(3,'dasdas','Blast','dasd@gmail.com','$2a$10$pdA5erxh1Z9o7YvwhhTuGeFdc7aL7Sdnbp712veilcErsQ.mG7kJy','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1724142786/atrvyo6k4spa8q3fxx7v.jpg','Building intelligent defenses against evolving cyber threats.  Passionate about integrating AI and machine learning into cybersecurity solutions.  Proficient in [List key skills/tools, e.g., Python, threat modeling, intrusion detection, machine learning algorithms]. #Cybersecurity #AI #MachineLearning #CyberThreats #InfoSec',0,'2025-01-11 04:01:48','2025-02-10 14:14:16','AI-Driven Cybersecurity Engineer'),(4,'dasdas','avc','sdacd@gmail.com','$2a$10$FBcfUytTJEXTCtYQ2b6nceG9.lZb.wmKgAXLUhJ8huubDRszNlsiO','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1724124769/dizlohblxkluqtrdbhyu.jpg','Developing cutting-edge AI-powered applications. Bridging the gap between software engineering and artificial intelligence.  Experienced in [List key skills/tools, e.g., Python, Java, cloud computing, deep learning frameworks]. #SoftwareEngineering #AI #DeepLearning #CloudComputing #SoftwareDevelopment',0,'2025-01-11 04:01:48','2025-02-10 14:14:16','AI Software Engineer'),(5,'dasdas','avcb','sdaed@gmail.com','$2a$10$lpeG9Yt8tAsbGnI7Jx93F.e.M2BIS6mDptg/Vbbyge5DsJlmVie9e','','Building the future of intelligent systems.  Combining expertise in software engineering, AI development, and cybersecurity to create robust and secure solutions.  Passionate about innovation and pushing the boundaries of technology. #AI #SoftwareEngineering #Cybersecurity #FullStack #Innovation',0,'2025-01-11 04:01:48','2025-02-10 14:14:16','Full-Stack AI Engineer'),(6,'Phi1','Blast1','phih1@gmail.com','$2a$10$kQ9u.rje3FKzy5GRye6jNu9YisD14FPR62g/4on.BS3VvWOz4HkmC','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1741764940/lzyu7pbrwyllpukaky56.jpg','Designing and implementing secure AI solutions.  Leading teams in developing innovative AI-driven cybersecurity products.  Experienced in [Mention specific areas of expertise, e.g., cloud security, data privacy, AI ethics]. #AI #Cybersecurity #SoftwareArchitecture #Leadership #CloudSecurity',0,'2025-01-11 04:01:48','2025-03-12 07:35:41','Lead AI & Security Architect'),(7,'Hau','Hau1','Hau1@gmail.com','$2a$10$PKs9ioq5t6PWiQ9C.c3Vv.GDfPCYyYi9ubrr6foH65PetcyIT7Lhm','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1741860922/q0zmbk9fitojefupwscz.jpg','Recent graduate passionate about applying AI to solve cybersecurity challenges.  Eager to learn and contribute to the development of intelligent security systems.  Proficient in Python and exploring machine learning techniques for threat detection.  #AI #Cybersecurity #SoftwareEngineering #MachineLearning #JuniorEngineer',0,'2025-01-11 04:01:48','2025-03-13 10:15:22','Junior AI Software Engineer'),(8,'Tien','Tien','Tien@gmail.com','$2a$10$2yv7M1A0gphG.yUO8genVeVU6u.PYO513ZK4iiL/odmznOwc96v9W','','',0,'2025-01-11 04:01:48','2025-03-26 03:17:23','Security Analyst'),(9,'Tien1','Tien1','Tien1@gmail.com','$2a$10$6QKNdwYvUGRskqiMD1.WeOX1tK94x6bef7.ll1YmqOBsfCeDSGVOy','','',0,'2025-01-11 04:01:48','2025-03-26 03:23:02','Security Architect'),(10,'Thang','Thang','Thang@gmail.com','$2a$10$Dyn/6rTn7Q60mM4Dl9WwvOHHZG7Qm9ikM9UxdfIE3OJUOByfHhXm.','https://res.cloudinary.com/dqgdjmyrs/image/upload/v1738807877/thsfh16blqv9njzbcrnw.webp','Cybersecurity Engineer | Building the next generation of secure systems.',0,'2025-01-11 04:01:48','2025-02-06 02:11:17','Cybersecurity Engineer'),(11,'Quan','Quan','Quan@gmail.com','$2a$10$axACwOJHC9eDDD9rww3KA.FDeOS3iD/LV1Dhrd5v6jdQsWRfSrDfS','','0',0,'2025-01-11 04:01:48','2025-01-11 04:01:48',NULL),(23,'Blast2003','Blast2003','Blast2003@gmail.com','$2a$10$rJpzfyQwZqZ.NQKcOgiFk.eDuQFf7/9sDqVU/1G64jJc1Ib1UcU/e','https://avatars.githubusercontent.com/u/137771969?v=4',NULL,0,'2025-02-28 04:04:24','2025-02-28 04:04:24',NULL),(25,'Đình Phi Hoàng','Đình Phi','phih2k3@gmail.com','$2a$10$//9xLUY28cCoKUn8gd51xuc9LNqC9ex4nlGnZT4FJahWMtmrCozWq','https://lh3.googleusercontent.com/a/ACg8ocIg8riSCv-CXF8wWeO8Y1B9Tyd50rFX6Ai16yWnaAUWpcVcFQ=s96-c',NULL,0,'2025-02-28 04:47:58','2025-02-28 04:47:58',NULL),(30026,'Blast2003','Blast2003','Blast2003@github.com','$2a$10$6spu0fH6uWscyChixuz13.a1sHhS5brc0N8Eyvjmh0ytFIKq8FC5e','https://avatars.githubusercontent.com/u/137771969?v=4',NULL,0,'2025-04-05 14:43:52','2025-04-05 14:43:52',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-04-17 10:20:55
