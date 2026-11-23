cmake_minimum_required(VERSION 3.10)
project(p2p_sync_spike C)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# S2 P2P Sync — targets ejecutados por los scripts de test
#   test_discovery.sh  -> discovery_test
#   test_heartbeat.sh  -> heartbeat_test
#   test_failover.sh   -> failover_test

add_executable(discovery_test  discovery_test.c)
add_executable(heartbeat_test  heartbeat_test.c)
add_executable(failover_test   failover_test.c)

# sockets + hilos (maestro envía heartbeats mientras escucha)
target_link_libraries(discovery_test  PRIVATE ${CMAKE_THREAD_LIBS_INIT})
target_link_libraries(heartbeat_test  PRIVATE ${CMAKE_THREAD_LIBS_INIT})
target_link_libraries(failover_test   PRIVATE ${CMAKE_THREAD_LIBS_INIT})
