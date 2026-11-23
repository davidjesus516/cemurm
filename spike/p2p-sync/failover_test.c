/* S2 P2P Sync — maestro failover test (localhost)
 *
 * Multicast 239.255.0.3:6001. Un nodo arranca como maestro y emite
 * heartbeats cada 20 ms. Los esclavos reciben y, si dejan de recibir
 * heartbeats por más de ~100 ms (3 heartbeats perdidos), asumen que el
 * maestro murió y se convierten en el nuevo maestro (empiezan a emitir).
 *
 * CSV de salida (columnas): role,node_id,seq,timestamp
 *
 * Uso maestro:   failover_test --role master --output out.master.csv
 * Uso esclavo:   failover_test --role slave --master-ip 127.0.0.1 \
 *                                   --output out.slave.csv --node-id slave1
 *
 * El script test_failover.sh lanza 1 master + 2 slaves, mata al maestro
 * con SIGKILL tras 5 s y mide el gap hasta que un nuevo maestro emite.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <time.h>

#define MCAST_ADDR "239.255.0.3"
#define MCAST_PORT 6001
#define INTERVAL_US 20000     /* 20 ms entre heartbeats */
#define FAILOVER_TIMEOUT_US 100000 /* 100 ms sin HB => failover */

static volatile sig_atomic_t running = 1;
static void handle_signal(int sig) { (void)sig; running = 0; }

static double now_seconds(void)
{
	struct timespec ts;
	clock_gettime(CLOCK_MONOTONIC, &ts);
	return ts.tv_sec + ts.tv_nsec / 1e9;
}

int main(int argc, char *argv[])
{
	const char *role = "master";
	const char *output = "failover.csv";
	const char *master_ip = "127.0.0.1";
	const char *node_id = "master";

	for (int i = 1; i < argc; i++) {
		if (strcmp(argv[i], "--role") == 0 && i + 1 < argc)
			role = argv[++i];
		else if (strcmp(argv[i], "--output") == 0 && i + 1 < argc)
			output = argv[++i];
		else if (strcmp(argv[i], "--master-ip") == 0 && i + 1 < argc)
			master_ip = argv[++i];
		else if (strcmp(argv[i], "--node-id") == 0 && i + 1 < argc)
			node_id = argv[++i];
	}

	(void)master_ip; /* multicast: no hay IP de maestro fija */

	signal(SIGINT, handle_signal);
	signal(SIGTERM, handle_signal);

	FILE *csv = fopen(output, "w");
	if (!csv) { perror("fopen output"); return 1; }
	fprintf(csv, "role,node_id,seq,timestamp\n");
	fflush(csv);

	int sock = socket(AF_INET, SOCK_DGRAM, 0);
	if (sock < 0) { perror("socket"); fclose(csv); return 1; }

	int reuse = 1;
	setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

	int is_master = (strcmp(role, "master") == 0);
	int seq = 0;
	double last_hb_received = now_seconds();

	if (is_master) {
		int loop = 0;
		setsockopt(sock, IPPROTO_IP, IP_MULTICAST_LOOP, &loop, sizeof(loop));
		int ttl = 1;
		setsockopt(sock, IPPROTO_IP, IP_MULTICAST_TTL, &ttl, sizeof(ttl));
	} else {
		struct sockaddr_in addr;
		memset(&addr, 0, sizeof(addr));
		addr.sin_family = AF_INET;
		addr.sin_addr.s_addr = htonl(INADDR_ANY);
		addr.sin_port = htons(MCAST_PORT);
		if (bind(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
			perror("bind"); close(sock); fclose(csv); return 1;
		}

		struct ip_mreq mreq;
		memset(&mreq, 0, sizeof(mreq));
		mreq.imr_multiaddr.s_addr = inet_addr(MCAST_ADDR);
		mreq.imr_interface.s_addr = htonl(INADDR_ANY);
		setsockopt(sock, IPPROTO_IP, IP_ADD_MEMBERSHIP, &mreq, sizeof(mreq));
	}

	struct sockaddr_in dst;
	memset(&dst, 0, sizeof(dst));
	dst.sin_family = AF_INET;
	dst.sin_addr.s_addr = inet_addr(MCAST_ADDR);
	dst.sin_port = htons(MCAST_PORT);

	char buf[128];
	struct sockaddr_in src;
	socklen_t slen = sizeof(src);

	while (running) {
		double now = now_seconds();

		if (is_master) {
			/* Emitir heartbeat cada 20 ms */
			char msg[64];
			int len = snprintf(msg, sizeof(msg), "HB %d %.6f", seq, now);
			sendto(sock, msg, (size_t)len, 0,
			       (struct sockaddr *)&dst, sizeof(dst));
			fprintf(csv, "master,%s,%d,%.6f\n", node_id, seq, now);
			fflush(csv);
			seq++;
			usleep(INTERVAL_US);
		} else {
			/* Esperar heartbeat con timeout */
			struct timeval tv = {0, 50000}; /* 50 ms */
			setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

			ssize_t n = recvfrom(sock, buf, sizeof(buf) - 1, 0,
					     (struct sockaddr *)&src, &slen);
			if (n > 0) {
				buf[n] = '\0';
				int rseq;
				double rts;
				if (sscanf(buf, "HB %d %lf", &rseq, &rts) == 2) {
					last_hb_received = now_seconds();
					fprintf(csv, "slave,%s,%d,%.6f\n", node_id, rseq, now);
					fflush(csv);
				}
			} else {
				/* Sin heartbeat: detectar failover */
				double silent = (now - last_hb_received) * 1e6;
				if (silent > FAILOVER_TIMEOUT_US && !is_master) {
					fprintf(stderr, "[%s] maestro caído, asumiendo liderazgo\n", node_id);
					is_master = 1;
					int loop = 0;
					setsockopt(sock, IPPROTO_IP, IP_MULTICAST_LOOP, &loop, sizeof(loop));
					int ttl = 1;
					setsockopt(sock, IPPROTO_IP, IP_MULTICAST_TTL, &ttl, sizeof(ttl));
					seq = 0;
					last_hb_received = now_seconds();
					continue;
				}
			}
		}
	}

	close(sock);
	fclose(csv);
	return 0;
}
