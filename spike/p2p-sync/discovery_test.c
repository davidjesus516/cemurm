/* S2 P2P Sync — mDNS/UDP discovery test (localhost)
 *
 * Cada nodo se une al grupo multicast 239.255.0.1:5999, anuncia su
 * node-id cada ~300 ms e imprime "Discovered peer <id>" en el log cada
 * vez que recibe el anuncio de un nodo distinto.
 *
 * Uso: discovery_test --node-id <id> --port <puerto_servicio> --log <path>
 *
 * El script test_discovery.sh lanza N instancias en localhost con
 * puertos 5001..500N y espera N*(N-1) descubrimientos mutuos.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>

#define MCAST_ADDR "239.255.0.1"
#define MCAST_PORT 5999

static volatile sig_atomic_t running = 1;
static void handle_signal(int sig) { (void)sig; running = 0; }

int main(int argc, char *argv[])
{
	const char *node_id = "node";
	int service_port = 5000;
	const char *log_path = "discovery.log";

	for (int i = 1; i < argc; i++) {
		if (strcmp(argv[i], "--node-id") == 0 && i + 1 < argc)
			node_id = argv[++i];
		else if (strcmp(argv[i], "--port") == 0 && i + 1 < argc)
			service_port = atoi(argv[++i]);
		else if (strcmp(argv[i], "--log") == 0 && i + 1 < argc)
			log_path = argv[++i];
	}

	FILE *log = fopen(log_path, "w");
	if (!log) { perror("fopen log"); return 1; }

	int sock = socket(AF_INET, SOCK_DGRAM, 0);
	if (sock < 0) { perror("socket"); fclose(log); return 1; }

	int reuse = 1;
	setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

	/* Bind al puerto de descubrimiento (compartido por todos los nodos) */
	struct sockaddr_in addr;
	memset(&addr, 0, sizeof(addr));
	addr.sin_family = AF_INET;
	addr.sin_addr.s_addr = htonl(INADDR_ANY);
	addr.sin_port = htons(MCAST_PORT);
	if (bind(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
		perror("bind"); close(sock); fclose(log); return 1;
	}

	/* Unirse al grupo multicast */
	struct ip_mreq mreq;
	memset(&mreq, 0, sizeof(mreq));
	mreq.imr_multiaddr.s_addr = inet_addr(MCAST_ADDR);
	mreq.imr_interface.s_addr = htonl(INADDR_ANY);
	if (setsockopt(sock, IPPROTO_IP, IP_ADD_MEMBERSHIP, &mreq, sizeof(mreq)) < 0) {
		perror("setsockopt IP_ADD_MEMBERSHIP"); close(sock); fclose(log); return 1;
	}

	/* Socket de envío */
	int tx = socket(AF_INET, SOCK_DGRAM, 0);
	if (tx < 0) { perror("socket tx"); close(sock); fclose(log); return 1; }
	int ttl = 1;
	setsockopt(tx, IPPROTO_IP, IP_MULTICAST_TTL, &ttl, sizeof(ttl));
	int loop = 0; /* no recibir nuestros propios anuncios */
	setsockopt(tx, IPPROTO_IP, IP_MULTICAST_LOOP, &loop, sizeof(loop));

	struct sockaddr_in dst;
	memset(&dst, 0, sizeof(dst));
	dst.sin_family = AF_INET;
	dst.sin_addr.s_addr = inet_addr(MCAST_ADDR);
	dst.sin_port = htons(MCAST_PORT);

	signal(SIGINT, handle_signal);
	signal(SIGTERM, handle_signal);

	/* Anuncio inmediato */
	sendto(tx, node_id, strlen(node_id), 0, (struct sockaddr *)&dst, sizeof(dst));

	while (running) {
		sendto(tx, node_id, strlen(node_id), 0, (struct sockaddr *)&dst, sizeof(dst));

		struct timeval tv = {0, 200000}; /* 200 ms timeout */
		setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

		char buf[256];
		struct sockaddr_in src;
		socklen_t slen = sizeof(src);
		ssize_t n = recvfrom(sock, buf, sizeof(buf) - 1, 0,
				     (struct sockaddr *)&src, &slen);
		if (n > 0) {
			buf[n] = '\0';
			if (strcmp(buf, node_id) != 0) {
				fprintf(log, "Discovered peer %s\n", buf);
				fflush(log);
			}
		}

		usleep(300000); /* 300 ms entre anuncios */
	}

	close(tx);
	close(sock);
	fclose(log);
	return 0;
}
